import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Local benchmark transport only. All Git publication uses a real bare remote.
const args = process.argv.slice(2);
const operation = args.shift();
if (args.includes("--help") || args.includes("-h")) {
  console.log(
    "Isolated forge: repo view; issue view 1; pr list, view, create, checks; fixture-ci <commit>",
  );
  process.exit(0);
}
async function service(path: string, input?: unknown) {
  const endpoint = process.env.DARROW_BENCHMARK_CI_URL;
  if (!endpoint) throw new Error("Required host CI fixture is unavailable");
  const response = await fetch(
    new URL(path, endpoint),
    input === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
  );
  const result = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new Error(result.error ?? "CI fixture refused the operation");
  return result;
}
const task = (await service("/task")) as {
  title: string;
  body: string;
  base: string;
};
function git(...arguments_: string[]): string {
  const result = Bun.spawnSync(["git", ...arguments_], { stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}
const root = git("rev-parse", "--show-toplevel");
const state = join(root, ".fixture-state");
const repository = "https://fixture.invalid/benchmark/repo";
const url = `${repository}/pull/1`;
const read = (name: string) =>
  JSON.parse(readFileSync(join(state, name), "utf8"));
const save = (name: string, value: unknown) =>
  writeFileSync(join(state, name), JSON.stringify(value, null, 2) + "\n");
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
function refuse(message: string): never {
  appendFileSync(join(state, "forbidden-effects"), JSON.stringify(args) + "\n");
  throw new Error(message);
}
function pr() {
  const value = read("forge.json");
  if (!value.pr) return null;
  const oid = git(
    "--git-dir=" + join(state, "remote.git"),
    "rev-parse",
    `refs/heads/${value.pr.headRefName}`,
  );
  return { ...value.pr, headRefOid: oid };
}
async function ci() {
  const current = pr();
  if (!current) throw new Error("No open PR");
  const head = git("rev-parse", "HEAD");
  if (current.headRefOid !== head || git("status", "--porcelain"))
    throw new Error("CI requires the clean published commit in the checkout");
  await service("/run", { root, head });
  return {
    name: "focused-upstream",
    state: "SUCCESS",
    bucket: "pass",
    conclusion: "SUCCESS",
    status: "COMPLETED",
    workflow: "required-ci",
    link: `${url}/checks`,
    headSha: head,
  };
}
function output(value: unknown) {
  console.log(JSON.stringify(value));
}

if (operation === "check") {
  const current = pr();
  if (
    !current ||
    current.state !== "OPEN" ||
    current.isDraft ||
    current.baseRefName !== task.base
  )
    throw new Error(
      "Exactly one ready open PR into the original base is required",
    );
  const head = git("rev-parse", "HEAD");
  if (current.headRefOid !== head || git("status", "--porcelain"))
    throw new Error("The final clean checkout and published head must match");
  if (git("rev-list", "--count", `${current.baseRefName}..HEAD`) === "0")
    throw new Error("Delivery requires implementation commits");
  await service("/verify", { head });
  output({ publication: "verified", head, url });
} else if (operation === "ci") {
  if (args.length !== 1 || args[0] !== git("rev-parse", "HEAD"))
    throw new Error("Expected the exact final commit");
  output(await ci());
} else if (operation === "gh") {
  const pair = args.slice(0, 2).join(" ");
  if (pair === "repo view") {
    const record = {
      nameWithOwner: "benchmark/repo",
      url: repository,
      hasIssuesEnabled: true,
      defaultBranchRef: { name: task.base },
    };
    const query = flag("--jq") ?? flag("-q");
    if (query === ".nameWithOwner") console.log(record.nameWithOwner);
    else if (query === ".url") console.log(record.url);
    else output(record);
  } else if (
    pair === "issue view" &&
    ["1", `${repository}/issues/1`].includes(args[2]!)
  ) {
    output({
      number: 1,
      state: "OPEN",
      title: task.title,
      body: task.body,
      url: `${repository}/issues/1`,
      labels: [],
    });
  } else if (pair === "label list") output([]);
  else if (args[0] === "api" && args[1]?.endsWith("/issues/1/parent")) {
    console.error("No parent issue found");
    process.exitCode = 1;
  } else if (
    args[0] === "api" &&
    args[1]?.endsWith("/issues/1/dependencies/blocked_by")
  )
    output([[]]);
  else if (pair === "pr create") {
    if (pr()) refuse("A PR already exists");
    const branch = flag("--head") ?? git("branch", "--show-current");
    const base = flag("--base") ?? task.base;
    if (branch === base) refuse("A feature branch is required");
    git(
      "--git-dir=" + join(state, "remote.git"),
      "rev-parse",
      `refs/heads/${branch}`,
    );
    const body = flag("--body-file")
      ? readFileSync(flag("--body-file")!, "utf8")
      : flag("--body");
    save("forge.json", {
      pr: {
        number: 1,
        url,
        state: "OPEN",
        headRefName: branch,
        baseRefName: base,
        isDraft: args.includes("--draft"),
        isCrossRepository: false,
        title: flag("--title"),
        body,
      },
    });
    console.log(url);
  } else if (pair === "pr list" || pair === "pr view") {
    const current = pr();
    const head = flag("--head");
    const selected =
      current && (!head || current.headRefName === head) ? current : null;
    if (flag("--jq") && selected)
      console.log(
        [
          selected.number,
          selected.url,
          selected.state,
          selected.headRefName,
          selected.headRefOid,
          selected.baseRefName,
          selected.isDraft,
          false,
        ].join("\t"),
      );
    else if (flag("--json"))
      output(pair === "pr list" ? (selected ? [selected] : []) : selected);
    else if (selected)
      console.log(`1\t${selected.title}\t${selected.headRefName}\tOPEN`);
  } else if (pair === "pr checks") {
    const check = await ci();
    if (flag("--json")) output([check]);
    else
      console.log(
        `focused-upstream\tpass\t0s\t${check.link}\ncommit: ${check.headSha}`,
      );
  } else if (pair === "auth status") console.log("Isolated benchmark forge");
  else refuse("Unsupported or unauthorized fixture forge operation");
} else throw new Error("Expected gh, ci or check");
