import type { NodeProps } from '@xyflow/react';
import type { FlowPortalNode } from '../utils/graphToFlow';
import './PortalNodeCard.css';

export function PortalNodeCard({ data }: NodeProps<FlowPortalNode>) {
  return (
    <div className="portal-card">
      <div className="portal-card-title">Portal</div>
      <div className="portal-card-target">{data.targetNodeId}</div>
      <div className="portal-card-source">from {data.sourceNodeId}</div>
    </div>
  );
}
