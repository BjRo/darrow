"""Repository coordination shared by independently configured single workers."""

from pathlib import Path

from .models import Claim, Grant, Shared
from .storage import read_object, write_object


class Installation:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    @property
    def grant(self) -> Grant:
        value = read_object(self.root / "grant.json")
        if value.get("schema_version") != 2:
            raise ValueError(
                "Legacy installation: reconcile original execution and effects before creating a new worker"
            )
        grant = Grant.model_validate(value)
        shared = Path(grant.common_git) / "artificer" / "repository.json"
        settings = Shared.model_validate(read_object(shared))
        if (settings.repository, settings.host) != (grant.repository, grant.host):
            raise ValueError("Worker does not match repository host configuration")
        grant.WORK_IN_PROGRESS_LIMIT = settings.WORK_IN_PROGRESS_LIMIT
        return grant

    @property
    def shared(self) -> Path:
        return Path(self.grant.common_git) / "artificer"

    def configure_capacity(self, limit: int) -> None:
        value = read_object(self.shared / "repository.json")
        value["WORK_IN_PROGRESS_LIMIT"] = limit
        write_object(self.shared / "repository.json", value)

    @property
    def lock(self) -> Path:
        return Path(self.grant.common_git) / "artificer" / "admission.lock"

    def save_grant(self, grant: Grant) -> None:
        write_object(self.root / "grant.json", grant.model_dump())

    def claim_path(self, delivery: str) -> Path:
        from uuid import UUID

        if str(UUID(delivery)) != delivery:
            raise ValueError("Delivery must be its canonical UUID")
        return self.shared / "deliveries" / delivery / "claim.json"

    def claim(self, delivery: str) -> Claim:
        claim = Claim.model_validate(read_object(self.claim_path(delivery)))
        if claim.id != delivery or claim.grant != self.grant.id:
            raise ValueError("Delivery correlation does not match this grant")
        return claim

    def claims(self) -> list[Claim]:
        return [
            claim for claim in self.repository_claims() if claim.grant == self.grant.id
        ]

    def repository_claims(self) -> list[Claim]:
        return [
            Claim.model_validate(read_object(path))
            for path in sorted((self.shared / "deliveries").glob("*/claim.json"))
        ]

    def save(self, claim: Claim) -> None:
        write_object(self.claim_path(claim.id), claim.model_dump())

    def delivery_dir(self, delivery: str) -> Path:
        return self.claim_path(delivery).parent

    def verify_binding(self) -> None:
        binding = read_object(self.shared / "workers" / f"{self.grant.id}.json")
        if binding != {"root": str(self.root), "grant": self.grant.id}:
            raise ValueError(
                "Repository belongs to a different controlling installation"
            )
