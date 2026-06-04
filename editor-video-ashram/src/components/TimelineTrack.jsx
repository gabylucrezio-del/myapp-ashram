import React, { memo } from "react";

function TimelineTrack({ label, icon: Icon, children }) {
  return (
    <div className="timeline-track-row">
      <div className="timeline-track-label">
        {Icon && <Icon size={17} />}
        <span>{label}</span>
      </div>
      <div className="timeline-track-lane">{children}</div>
    </div>
  );
}

export default memo(TimelineTrack);
