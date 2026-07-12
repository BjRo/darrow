package sqlpg

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"backend/internal/domain"
)

// PositioningReviewRepository implements domain.PositioningReviewRepository using database/sql.
type PositioningReviewRepository struct {
	db *sql.DB
}

// NewPositioningReviewRepository creates a new database/sql positioning review repository.
func NewPositioningReviewRepository(db *sql.DB) *PositioningReviewRepository {
	return &PositioningReviewRepository{db: db}
}

const upsertReviewSQL = `
INSERT INTO positioning_reviews
	(id, fork_id, findings, overall_assessment, verdict, applied_finding_indices, fork_state_snapshot, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (fork_id) DO UPDATE SET
	findings = EXCLUDED.findings,
	overall_assessment = EXCLUDED.overall_assessment,
	verdict = EXCLUDED.verdict,
	applied_finding_indices = EXCLUDED.applied_finding_indices,
	fork_state_snapshot = EXCLUDED.fork_state_snapshot,
	updated_at = EXCLUDED.updated_at`

// execer covers *sql.DB and *sql.Tx for the shared upsert.
type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func upsertReview(ctx context.Context, ex execer, review *domain.PositioningReview) error {
	now := time.Now()
	review.UpdatedAt = now
	if review.ID == uuid.Nil {
		review.ID = uuid.New()
		review.CreatedAt = now
	}
	if _, err := ex.ExecContext(ctx, upsertReviewSQL,
		review.ID, review.ForkID, review.Findings, review.OverallAssessment,
		review.Verdict, review.AppliedFindingIndices, review.ForkStateSnapshot,
		review.CreatedAt, review.UpdatedAt,
	); err != nil {
		return fmt.Errorf("upsert positioning review: %w", err)
	}
	return nil
}

// Upsert creates or replaces a positioning review for the given fork.
func (r *PositioningReviewRepository) Upsert(ctx context.Context, review *domain.PositioningReview) error {
	return upsertReview(ctx, r.db, review)
}

// GetByForkID retrieves the positioning review for a fork.
// Returns nil, nil when no review exists.
func (r *PositioningReviewRepository) GetByForkID(ctx context.Context, forkID uuid.UUID) (*domain.PositioningReview, error) {
	review := new(domain.PositioningReview)
	err := r.db.QueryRowContext(ctx,
		`SELECT id, fork_id, findings, overall_assessment, verdict, applied_finding_indices, fork_state_snapshot, created_at, updated_at
		 FROM positioning_reviews
		 WHERE fork_id = $1`,
		forkID,
	).Scan(
		&review.ID, &review.ForkID, &review.Findings, &review.OverallAssessment,
		&review.Verdict, &review.AppliedFindingIndices, &review.ForkStateSnapshot,
		&review.CreatedAt, &review.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get positioning review by fork_id: %w", err)
	}
	return review, nil
}

// UpsertWithForkStatus atomically upserts the review and updates the fork's
// review_status and review_error in a single transaction.
func (r *PositioningReviewRepository) UpsertWithForkStatus(ctx context.Context, review *domain.PositioningReview, fork *domain.ProfileFork) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck // No-op after commit

	if err := upsertReview(ctx, tx, review); err != nil {
		return err
	}

	fork.UpdatedAt = time.Now()
	if _, err := tx.ExecContext(ctx,
		`UPDATE profile_forks
		 SET review_status = $1, review_error = $2, updated_at = $3
		 WHERE id = $4`,
		fork.ReviewStatus, fork.ReviewError, fork.UpdatedAt, fork.ID,
	); err != nil {
		return fmt.Errorf("update fork review status in tx: %w", err)
	}

	return tx.Commit()
}

// AddAppliedFindingIndex atomically appends a finding index to the review's
// applied_finding_indices JSONB array. Idempotent: duplicate indices are ignored.
// Returns the updated review.
func (r *PositioningReviewRepository) AddAppliedFindingIndex(ctx context.Context, forkID uuid.UUID, index int) (*domain.PositioningReview, error) {
	review := new(domain.PositioningReview)
	err := r.db.QueryRowContext(ctx,
		`UPDATE positioning_reviews
		 SET applied_finding_indices = applied_finding_indices || to_jsonb($2::int),
		     updated_at = now()
		 WHERE fork_id = $1
		   AND NOT (applied_finding_indices @> to_jsonb($2::int))
		 RETURNING id, fork_id, findings, overall_assessment, verdict, applied_finding_indices, fork_state_snapshot, created_at, updated_at`,
		forkID, index,
	).Scan(
		&review.ID, &review.ForkID, &review.Findings, &review.OverallAssessment,
		&review.Verdict, &review.AppliedFindingIndices, &review.ForkStateSnapshot,
		&review.CreatedAt, &review.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		// Either the index was already present (idempotent) or no review exists.
		// Try to fetch the current review to distinguish.
		existing, getErr := r.GetByForkID(ctx, forkID)
		if getErr != nil {
			return nil, getErr
		}
		if existing == nil {
			return nil, fmt.Errorf("%w: no positioning review for fork %s", domain.ErrNotFound, forkID)
		}
		return existing, nil
	}
	if err != nil {
		return nil, fmt.Errorf("add applied finding index: %w", err)
	}

	return review, nil
}

// Verify PositioningReviewRepository implements domain.PositioningReviewRepository.
var _ domain.PositioningReviewRepository = (*PositioningReviewRepository)(nil)
