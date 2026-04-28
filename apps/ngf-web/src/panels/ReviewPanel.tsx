import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { canEdit, canReview } from '../utils/collaboration';
import type { CollaborationRole } from '../utils/collaboration';

const ROLE_OPTIONS: CollaborationRole[] = ['owner', 'editor', 'reviewer', 'viewer'];

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function ReviewPanel() {
  const {
    graph,
    selectedNodeId,
    collaboration,
    setCollaborationRole,
    createSnapshot,
    restoreSnapshot,
    createBranch,
    switchBranch,
    addReviewComment,
    resolveReviewComment,
    getActiveDiff,
    selectNode,
  } = useAppStore();
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [branchName, setBranchName] = useState('');
  const [commentBody, setCommentBody] = useState('');

  const diff = useMemo(
    () => getActiveDiff(),
    [getActiveDiff, graph, collaboration.activeBranchId, collaboration.snapshots],
  );
  const activeBranch = collaboration.branches.find((branch) => branch.id === collaboration.activeBranchId);
  const editable = canEdit(collaboration.role);
  const reviewable = canReview(collaboration.role);
  const openComments = collaboration.comments.filter((comment) => comment.status === 'open');

  function submitSnapshot() {
    createSnapshot(snapshotLabel);
    setSnapshotLabel('');
  }

  function submitBranch() {
    createBranch(branchName);
    setBranchName('');
  }

  function submitComment() {
    addReviewComment(commentBody, selectedNodeId);
    setCommentBody('');
  }

  return (
    <div className="review-panel">
      <div className="review-column review-column--version">
        <div className="review-head">
          <span className="review-title">Versioning</span>
          <span className="review-subtitle">{activeBranch?.name ?? 'main'}</span>
        </div>

        <label className="review-label">
          Local role
          <select
            className="review-input"
            value={collaboration.role}
            onChange={(event) => setCollaborationRole(event.target.value as CollaborationRole)}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>

        <div className="review-inline-form">
          <input
            className="review-input"
            value={snapshotLabel}
            placeholder="Snapshot label"
            disabled={!reviewable || !graph}
            onChange={(event) => setSnapshotLabel(event.target.value)}
          />
          <button className="review-btn review-btn--strong" disabled={!reviewable || !graph} onClick={submitSnapshot}>Save</button>
        </div>

        <div className="review-list">
          {collaboration.snapshots.length === 0 ? (
            <div className="review-empty">No snapshots yet.</div>
          ) : (
            collaboration.snapshots.map((snapshot) => (
              <div key={snapshot.id} className="review-item">
                <button className="review-item-main" onClick={() => restoreSnapshot(snapshot.id)} disabled={!editable}>
                  <span>{snapshot.label}</span>
                  <small>{snapshot.actor} / {formatTime(snapshot.createdAt)}</small>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="review-column review-column--diff">
        <div className="review-head">
          <span className="review-title">Branch & Diff</span>
          <span className="review-subtitle">{diff.length} changes</span>
        </div>

        <div className="review-inline-form">
          <input
            className="review-input"
            value={branchName}
            placeholder="Branch name"
            disabled={!editable || !graph}
            onChange={(event) => setBranchName(event.target.value)}
          />
          <button className="review-btn" disabled={!editable || !graph} onClick={submitBranch}>Branch</button>
        </div>

        <div className="review-branch-list">
          {collaboration.branches.map((branch) => (
            <button
              key={branch.id}
              className={`review-branch${branch.id === collaboration.activeBranchId ? ' review-branch--active' : ''}`}
              onClick={() => switchBranch(branch.id)}
            >
              <span>{branch.name}</span>
              <small>{formatTime(branch.updatedAt)}</small>
            </button>
          ))}
        </div>

        <div className="review-diff-list">
          {diff.length === 0 ? (
            <div className="review-empty">No diff from latest branch snapshot.</div>
          ) : (
            diff.map((item, index) => (
              <button
                key={`${item.kind}:${item.subject}:${index}`}
                className={`review-diff review-diff--${item.kind}`}
                onClick={() => selectNode(item.subject)}
              >
                <span>{item.kind}</span>
                <strong>{item.subject}</strong>
                <small>{item.detail}</small>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="review-column review-column--comments">
        <div className="review-head">
          <span className="review-title">Review</span>
          <span className="review-subtitle">{openComments.length} open</span>
        </div>

        <div className="review-comment-box">
          <textarea
            className="review-textarea"
            value={commentBody}
            placeholder={selectedNodeId ? `Comment on ${selectedNodeId}` : 'Workspace comment'}
            disabled={!reviewable}
            onChange={(event) => setCommentBody(event.target.value)}
          />
          <button className="review-btn review-btn--strong" disabled={!reviewable || !commentBody.trim()} onClick={submitComment}>Comment</button>
        </div>

        <div className="review-list">
          {collaboration.comments.length === 0 ? (
            <div className="review-empty">No review comments.</div>
          ) : (
            collaboration.comments.map((comment) => (
              <div key={comment.id} className={`review-comment review-comment--${comment.status}`}>
                <button className="review-comment-main" onClick={() => comment.nodeId && selectNode(comment.nodeId)}>
                  <span>{comment.nodeId ?? 'workspace'}</span>
                  <p>{comment.body}</p>
                  <small>{comment.author} / {formatTime(comment.createdAt)}</small>
                </button>
                {comment.status === 'open' && (
                  <button className="review-icon-btn" disabled={!reviewable} onClick={() => resolveReviewComment(comment.id)}>✓</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="review-column review-column--audit">
        <div className="review-head">
          <span className="review-title">Audit</span>
          <span className="review-subtitle">{collaboration.auditLog.length} events</span>
        </div>
        <div className="review-audit-list">
          {collaboration.auditLog.map((entry) => (
            <div key={entry.id} className={`review-audit review-audit--${entry.actor}`}>
              <span>{entry.action}</span>
              <p>{entry.detail}</p>
              <small>{entry.actor} / {formatTime(entry.createdAt)}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
