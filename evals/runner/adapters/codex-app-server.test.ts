import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appServerFinal,
  appServerGoalStatus,
  runCodexAppServer,
} from "./codex-app-server";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

// Protocol peer, not a simulated model: exercise the real process/stdio boundary.
const peer = `
import {createInterface} from 'node:readline';
import {appendFileSync} from 'node:fs';
const [scenario,trace]=process.argv.slice(2);
const send=value=>process.stdout.write(JSON.stringify(value)+'\\n');
const notify=(method,params)=>send({method,params});
const goal=status=>({threadId:'root',objective:'Read both markers',status});
const turns=[]; let starts=0;let continued=false;
const finish=(id,text)=>{
  const turn=turns.find(t=>t.id===id); turn.status='completed';
  turn.items=[{type:'agentMessage',id:'final-'+id,phase:scenario==='missing-final'?'commentary':'final_answer',text}];
  notify('thread/tokenUsage/updated',{threadId:'root',turnId:id,tokenUsage:{total:{inputTokens:100*turns.length,outputTokens:10*turns.length}}});
  notify('turn/completed',{threadId:'root',turn:{id,status:'completed',items:[]}});
};
const begin=id=>{turns.push({id,status:'inProgress',items:[]});notify('turn/started',{threadId:'root',turn:{id,status:'inProgress',items:[]}})};
createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);appendFileSync(trace,JSON.stringify(m)+'\\n');
 if(m.id===undefined)return;
 const reply=result=>send({id:m.id,result});
 if(m.method==='initialize')reply({});
 else if(m.method==='thread/start')reply({thread:{id:'root'},model:'gpt-6-luna',modelProvider:'openai',reasoningEffort:'medium'});
 else if(m.method==='turn/start'){
   starts++;const id='turn-'+starts;reply({turn:{id,status:'inProgress',items:[]}});begin(id);
   if(scenario==='timeout')return;
   if(scenario==='exit'){process.exit(0);return;}
   if(scenario==='server-request'){send({id:91,method:'item/tool/requestUserInput',params:{}});return;}
   if(scenario==='diagnostic-fatal'){
     notify('error',{threadId:'child',turnId:'child-turn',willRetry:false,error:{message:'CHILD_PRIVATE_ERROR'}});
     notify('error',{threadId:'root',turnId:id,willRetry:true,error:{message:'Connection lost',codexErrorInfo:{responseStreamDisconnected:{httpStatusCode:503}}}});
     notify('error',{threadId:'root',turnId:id,willRetry:false,error:{message:'Model is overloaded',codexErrorInfo:'serverOverloaded',additionalDetails:'PRIVATE_DETAILS',misalignment:{steer:{message:'PRIVATE_STEER'}}}});
     return;
   }
   if(scenario==='failed-turn'){
     notify('turn/completed',{threadId:'root',turn:{id,status:'failed',items:[],error:{message:'Access expired',codexErrorInfo:'unauthorized'}}});return;
   }
   if(scenario==='bounded-errors'){
     for(let n=0;n<40;n++)notify('error',{threadId:'root',turnId:id,willRetry:true,error:{message:'x'.repeat(3000),codexErrorInfo:'other'}});
     notify('error',{threadId:'root',turnId:id,willRetry:false,error:{message:'Authorization: Bearer sk-test-secret-value',codexErrorInfo:'unauthorized'}});return;
   }
   if(scenario==='continuation'||scenario==='failure')notify('thread/goal/updated',{threadId:'root',turnId:id,goal:goal('active')});
   finish(id,scenario==='continuation'||scenario==='failure'?'FIRST_CHECKPOINT':'FINAL-'+starts);
 }
 else if(m.method==='thread/goal/get'){
   if((scenario==='continuation'||scenario==='failure')&&!continued){
     reply({goal:goal('active')});continued=true;
     setTimeout(()=>{
       if(scenario==='failure'){notify('error',{threadId:'root',willRetry:false,error:{message:'Failure'}});return;}
       begin('native-2');
       notify('thread/goal/updated',{threadId:'child',turnId:'child-turn',goal:{...goal('complete'),threadId:'child'}});
       notify('turn/completed',{threadId:'child',turn:{id:'child-turn',status:'completed',items:[]}});
       notify('thread/goal/updated',{threadId:'root',turnId:'native-2',goal:goal('complete')});
       // Goal completion deliberately precedes the final response and turn completion.
       setTimeout(()=>finish('native-2','BOTH_MARKERS_COMPLETE'),40);
     },10);
   }else reply({goal:scenario==='continuation'?goal('complete'):null});
 }
 else if(m.method==='thread/read'){
   reply({thread:{id:'root',turns}});
   if(scenario==='trailing-malformed')process.stdout.write('NOT_JSON\\n');
   if(scenario==='trailing-error')notify('error',{threadId:'root',turnId:turns.at(-1).id,willRetry:false,error:{message:'Late failure',codexErrorInfo:'internalServerError'}});
 }
 else send({id:m.id,error:{code:-32601,message:'unexpected method'}});
});
`;

async function run(scenario: string, followUp = false) {
  const root = await mkdtemp(join(tmpdir(), "darrow-app-server-test-"));
  roots.push(root);
  await mkdir(join(root, ".git"));
  const script = join(root, "protocol-peer.ts"),
    trace = join(root, "requests.jsonl");
  await writeFile(script, peer);
  const options = {
    request: {
      repoDir: root,
      prompt: "Read both markers",
      model: "gpt-6-luna",
      effort: "medium",
      control: {
        codexEntrypoint: "app-server",
        appServerTimeoutMs: scenario === "timeout" ? 150 : 5000,
        ...(followUp ? { followUpPrompt: "User correction" } : {}),
      },
    },
    argv: [process.execPath, script, scenario, trace],
    env: { PATH: process.env.PATH ?? "" },
  };
  // Launch outside bun:test's own stdio lifecycle, as the live runner does.
  const driver = join(root, "driver.ts");
  const resultPath = join(root, "result.json");
  await writeFile(
    driver,
    `import {writeFile} from 'node:fs/promises';
import {runCodexAppServer} from ${JSON.stringify(join(import.meta.dir, "codex-app-server.ts"))};
const result=await runCodexAppServer({...${JSON.stringify(options)}, followUpBoundary:async()=>JSON.stringify({type:'darrow.eval.follow_up_turn'})});
await writeFile(${JSON.stringify(resultPath)},JSON.stringify(result));`,
  );
  const child = Bun.spawn([process.execPath, driver], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(stderr);
  const result = JSON.parse(await readFile(resultPath, "utf8")) as Awaited<
    ReturnType<typeof runCodexAppServer>
  >;
  const traceText = await readFile(trace, "utf8").catch(() => {
    throw new Error(JSON.stringify(result));
  });
  const requests = traceText
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  let final: string | undefined;
  try {
    final = await readFile(join(root, ".git/last-message.md"), "utf8");
  } catch {
    /* failure retains no invented final */
  }
  return { result, requests, final };
}

describe("Codex app-server entrypoint", () => {
  test("keeps the active native goal alive and waits for its completing response", async () => {
    const { result, requests, final } = await run("continuation");
    expect(result.code).toBe(0);
    expect(final).toBe("BOTH_MARKERS_COMPLETE");
    expect(result.evidence.finalTurnId).toBe("native-2");
    expect(result.evidence.goalStatus).toBe("complete");
    expect(result.evidence.clientTurns).toBe(1);
    expect(requests.filter((r) => r.method === "turn/start")).toHaveLength(1);
    expect(
      requests.some((r) =>
        ["thread/goal/set", "thread/goal/clear", "thread/resume"].includes(
          r.method,
        ),
      ),
    ).toBe(false);
    expect(result.evidence.turns.some((t) => t.id === "child-turn")).toBe(
      false,
    );
  });
  test("no-goal control finishes normally on the same entrypoint", async () => {
    const { result, final } = await run("no-goal");
    expect(result.code).toBe(0);
    expect(final).toBe("FINAL-1");
    expect(result.evidence.goalStatus).toBeNull();
  });
  test("preserves public retry and fatal diagnostics without child errors or private details", async () => {
    const { result, final, requests } = await run("diagnostic-fatal");
    expect(result.code).toBe(1);
    expect(final).toBeUndefined();
    expect(result.evidence.errors).toEqual([
      {
        source: "error",
        threadId: "root",
        turnId: "turn-1",
        willRetry: true,
        message: "Connection lost",
        code: "responseStreamDisconnected",
        httpStatusCode: 503,
      },
      {
        source: "error",
        threadId: "root",
        turnId: "turn-1",
        willRetry: false,
        message: "Model is overloaded",
        code: "serverOverloaded",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|CHILD_PRIVATE_ERROR/);
    expect(requests.filter((r) => r.method === "turn/start")).toHaveLength(1);
  });
  test("preserves a failed turn's error without requiring an error notification", async () => {
    const { result } = await run("failed-turn");
    expect(result.code).toBe(1);
    expect(result.evidence.errors).toEqual([
      {
        source: "turn/completed",
        threadId: "root",
        turnId: "turn-1",
        willRetry: null,
        message: "Access expired",
        code: "unauthorized",
      },
    ]);
  });
  test("bounds retained diagnostics and removes authorization credentials", async () => {
    const { result } = await run("bounded-errors");
    expect(result.code).toBe(1);
    expect(result.evidence.errors).toHaveLength(32);
    expect(result.evidence.errorsDropped).toBe(9);
    expect(result.evidence.errors?.[0]?.message).toHaveLength(2000);
    expect(result.evidence.errors?.[0]?.messageTruncated).toBe(true);
    expect(result.evidence.errors?.at(-1)?.message).toBe(
      "Authorization: [redacted]",
    );
    expect(JSON.stringify(result)).not.toContain("sk-test-secret-value");
  });
  for (const scenario of ["trailing-malformed", "trailing-error"]) {
    test(`${scenario} cannot turn a successful readback into a successful invocation`, async () => {
      const { result } = await run(scenario);
      expect(result.code).toBe(1);
      expect(result.evidence.failure).toBeTruthy();
      expect(result.out).toContain('"type":"turn.failed"');
      if (scenario === "trailing-error")
        expect(result.evidence.errors?.at(-1)).toMatchObject({
          source: "error",
          turnId: "turn-1",
          message: "Late failure",
          code: "internalServerError",
        });
    });
  }
  test("sends only the requested follow-up as a second client turn", async () => {
    const { result, requests, final } = await run("no-goal", true);
    expect(result.code).toBe(0);
    expect(final).toBe("FINAL-2");
    expect(result.evidence.clientTurns).toBe(2);
    expect(
      requests
        .filter((r) => r.method === "turn/start")
        .map((r) => r.params.input[0].text),
    ).toEqual(["Read both markers", "User correction"]);
  });
  for (const scenario of [
    "failure",
    "missing-final",
    "exit",
    "server-request",
    "timeout",
  ]) {
    test(`${scenario} fails without returning a previous checkpoint`, async () => {
      const { result, final } = await run(scenario);
      expect(result.code).toBe(1);
      expect(result.evidence.failure).toBeTruthy();
      expect(final).toBeUndefined();
    });
  }
  test("rejects unknown goal states, wrong threads and objectives over 4000 characters", () => {
    for (const goal of [
      { threadId: "other", status: "complete", objective: "x" },
      { threadId: "root", status: "done", objective: "x" },
      { threadId: "root", status: "active", objective: "x".repeat(4001) },
    ])
      expect(() => appServerGoalStatus(goal, "root")).toThrow();
    expect(
      appServerGoalStatus(
        { threadId: "root", status: "active", objective: "x".repeat(4000) },
        "root",
      ),
    ).toBe("active");
  });
  test("cannot substitute a previous turn or commentary for the completing final", () => {
    const thread = {
      turns: [
        {
          id: "old",
          status: "completed",
          items: [{ type: "agentMessage", phase: "final_answer", text: "old" }],
        },
        {
          id: "new",
          status: "completed",
          items: [
            { type: "agentMessage", phase: "commentary", text: "working" },
          ],
        },
      ],
    };
    expect(() => appServerFinal(thread, "new")).toThrow();
    expect(() => appServerFinal(thread, "missing")).toThrow();
  });
});
