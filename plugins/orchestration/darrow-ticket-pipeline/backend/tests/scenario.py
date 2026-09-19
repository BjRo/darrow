"""Drive real ticket-file transitions through the public command boundary."""

import io
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from darrow_ticket_pipeline.cli import main


class Scenario:
    def __init__(
        self, root: Path, body: str = "## Outcome\n\nReturn the requested value.\n"
    ) -> None:
        self.root = root
        self.root.mkdir(exist_ok=True)
        self.body = root / "ticket.md"
        self.body.write_bytes(body.encode("utf-8"))
        self.baseline = root / "baseline.txt"
        self.baseline.write_bytes(b" M user-owned.txt\n")
        self.sequence = 0
        self.iterations: dict[str, int] = {}
        self.invoke(
            "init",
            expected=0,
            **{
                "run-id": "test-run",
                "repo": str(root),
                "base-revision": "abc123",
                "baseline-file": str(self.baseline),
            },
        )

    def invoke(self, command: str, expected: int = 0, **options: str) -> str:
        self.sequence += 1
        values = {"body-file": str(self.body), **options}
        output = self.root / f"candidate-{self.sequence}.md"
        if command != "summary":
            values["output"] = str(output)
        args = [command]
        for key, value in values.items():
            args.extend(("--" + key, value))
        stdout, stderr = io.StringIO(), io.StringIO()
        before = self.body.read_bytes()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            code = main(args)
        assert code == expected, (args, code, stderr.getvalue())
        assert self.body.read_bytes() == before
        if code:
            assert stderr.getvalue().startswith("error:")
            assert not output.exists()
        elif command != "summary":
            assert f"body\t{output}\n" in stdout.getvalue()
            self.body = output
        return stdout.getvalue()

    def launch(self, phase: str, iteration: int, expected: int = 0) -> None:
        self.invoke(
            "launch",
            expected=expected,
            phase=phase,
            iteration=str(iteration),
            agent=f"{phase}-{iteration}",
            harness="codex",
            model="test-model",
            effort="medium",
        )

    def complete(
        self, phase: str, status: str, summary: str = "Phase evidence"
    ) -> None:
        iteration = self.iterations.get(phase, 0) + 1
        self.launch(phase, iteration)
        assert "next_phase\tfinish\n" in self.invoke("summary")
        artifact = self.root / f"{phase}-{iteration}.tsv"
        artifact.write_bytes(
            (
                "format\tdarrow-ticket-pipeline-phase-v1\nrun_id\ttest-run\n"
                f"phase\t{phase}\niteration\t{iteration}\nagent\t{phase}-{iteration}\n"
                f"status\t{status}\nsummary\t{summary}\n---\n### Evidence\n\n{summary}\n"
            ).encode()
        )
        result = self.invoke("record", expected=0, **{"artifact-file": str(artifact)})
        assert f"phase\t{phase}\t{status}\n" in result
        self.iterations[phase] = iteration
        text = self.body.read_text(encoding="utf-8")
        assert f"| {phase} | {status} | {iteration} |" in text
        assert (
            f"| {phase} | {iteration} | {phase}-{iteration} | codex | test-model | medium | {status} | {summary} |"
            in text
        )
        assert f"## Ticket Pipeline Artifact — {phase} — Iteration {iteration}" in text

    def implement(self) -> None:
        for phase, status in (
            ("refine", "complete"),
            ("challenge", "approved"),
            ("implement", "complete"),
        ):
            self.complete(phase, status)
