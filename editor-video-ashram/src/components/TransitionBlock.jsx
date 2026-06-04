import React from "react";

export default function TransitionBlock({ label }) {
  return (
    <span className="transition-block" title={label}>
      {label}
    </span>
  );
}
