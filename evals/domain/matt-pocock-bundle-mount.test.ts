import { expect, test } from "bun:test";
import { cp, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { captureTestCommand } from "../test-command";

const plugin = resolve("plugins/capability/darrow-matt-pocock");
const extension = resolve("evals/sevro-extension/index.ts");
async function request(method: string, params: Record<string, unknown>) {
  const result = await captureTestCommand(
    [process.execPath, extension],
    JSON.stringify({
      protocol: "sevro.extension.v1",
      id: method,
      method,
      params,
    }),
    { env: process.env },
  );
  expect(result.exitCode, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

test("isolated Matt package mounts both host entrypoints through the public extension protocol", async () => {
  const root = await mkdtemp(join(tmpdir(), "matt-mount-"));
  try {
    await mkdir(join(root, "plugins/capability"), { recursive: true });
    await cp(plugin, join(root, "plugins/capability/darrow-matt-pocock"), {
      recursive: true,
    });
    for (const host of ["codex", "claude"]) {
      const resolved = await request("resolve", {
        projectRoot: pathToFileURL(root).href,
        selectors: {
          caseIds: [
            host === "codex"
              ? "matt-bundle-setup-local"
              : "matt-bundle-domain-local",
          ],
        },
        configuration: {},
      });
      expect(resolved.result?.cases?.length, JSON.stringify(resolved)).toBe(1);
      const prepared = await request("prepare", {
        case: resolved.result.cases[0],
        host: {
          id: `sevro.host.${host}`,
          capabilities:
            host === "codex"
              ? [
                  "sevro.codex.plugin-marketplace",
                  "sevro.codex.explicit-invocation",
                ]
              : [
                  "sevro.claude.plugin-dirs",
                  "sevro.claude.explicit-invocation",
                ],
        },
        condition: "passive",
        configuration: {},
      });
      expect(prepared.error, JSON.stringify(prepared)).toBeUndefined();
      const artifacts = prepared.result.artifacts as Array<{
        relativePath: string;
        contentBase64: string;
      }>;
      const skill = artifacts.find((a) =>
        a.relativePath.endsWith("/skills/setup-matt-pocock-skills/SKILL.md"),
      );
      expect(skill).toBeDefined();
      const prefix = skill!.relativePath.split("/skills/")[0];
      expect(
        artifacts.some(
          (a) => a.relativePath === `${prefix}/references/COMPATIBILITY.md`,
        ),
      ).toBe(true);
      expect(
        artifacts.some(
          (a) => a.relativePath === `${prefix}/references/LICENSE`,
        ),
      ).toBe(true);
      for (const path of [
        "prototype/LOGIC.md",
        "codebase-design/DESIGN-IT-TWICE.md",
        "setup-matt-pocock-skills/agents/openai.yaml",
      ])
        expect(
          artifacts.some((a) => a.relativePath === `${prefix}/skills/${path}`),
        ).toBe(true);
      expect(artifacts.some((a) => a.relativePath.includes("/evals/"))).toBe(
        false,
      );
      expect(
        artifacts.some((a) => a.relativePath.includes("/skills/implement/")),
      ).toBe(false);
      if (host === "codex")
        expect(prepared.result.codexSkillInvocation).toEqual({
          pluginName: "darrow-matt-pocock",
          skillName: "setup-matt-pocock-skills",
        });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);
