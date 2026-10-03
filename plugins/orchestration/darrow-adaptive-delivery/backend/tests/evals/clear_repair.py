"""Hidden oracle: find unique valid current repair evidence, never sort by name.

This proves retained evidence exists. Capability handoff consumption is measured
separately from native assignment results, not inferred from a saved file.
"""

from pathlib import Path

from darrow_adaptive_delivery.fixtures import proof


def current_clear(repo: Path, backend: Path, state: Path, path: Path) -> bool:
    try:
        canonical = proof.canonical_record(state, str(path))
        target = proof.verification_target(backend, repo, state, canonical)
        proof.current(backend, repo, target)
    except (proof.InvalidProofError, OSError, UnicodeError):
        return False
    return True


def select(repo: Path) -> Path:
    state = proof.review_state_root()
    backend = proof.provider(repo / ".git")
    matches = [
        path
        for path in state.rglob("verification.json")
        if current_clear(repo, backend, state, path)
    ]
    if len(matches) != 1:
        raise proof.InvalidProofError(
            f"expected one valid clear current repair assessment, found {len(matches)}"
        )
    return matches[0]


def main() -> None:
    repo = Path.cwd()
    selected = select(repo)
    print(proof.validate(repo, "complete", str(selected)), end="")


if __name__ == "__main__":
    main()
