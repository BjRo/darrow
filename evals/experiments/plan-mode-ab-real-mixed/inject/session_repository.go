// Package sqlpg contains repository implementations written directly against
// database/sql with hand-written SQL statements.
package sqlpg

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"backend/internal/domain"
)

// SessionRepository implements domain.SessionStore using database/sql.
type SessionRepository struct {
	db *sql.DB
}

// NewSessionRepository creates a new database/sql session repository.
func NewSessionRepository(db *sql.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

// Create persists a new session.
func (r *SessionRepository) Create(ctx context.Context, session *domain.Session) error {
	if session.ID == uuid.Nil {
		session.ID = uuid.New()
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO sessions (id, user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3, $4)`,
		session.ID, session.UserID, session.TokenHash, session.ExpiresAt,
	)
	return err
}

// GetByTokenHash retrieves a session by its token hash.
// Returns nil, nil when not found.
func (r *SessionRepository) GetByTokenHash(ctx context.Context, tokenHash string) (*domain.Session, error) {
	session := new(domain.Session)
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, token_hash, expires_at, created_at
		 FROM sessions
		 WHERE token_hash = $1`,
		tokenHash,
	).Scan(&session.ID, &session.UserID, &session.TokenHash, &session.ExpiresAt, &session.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return session, nil
}

// DeleteByID removes a session by its ID.
func (r *SessionRepository) DeleteByID(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE id = $1`, id)
	return err
}

// DeleteByUserID removes all sessions for a user.
func (r *SessionRepository) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE user_id = $1`, userID)
	return err
}

// DeleteExpired removes all expired sessions. Returns the count of deleted rows.
func (r *SessionRepository) DeleteExpired(ctx context.Context) (int64, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at < NOW()`)
	if err != nil {
		return 0, err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return count, nil
}

// Compile-time check that SessionRepository implements domain.SessionStore.
var _ domain.SessionStore = (*SessionRepository)(nil)
