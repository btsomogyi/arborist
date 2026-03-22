import React from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

// Functional component with props
const Button = ({ label, onClick, disabled = false }: ButtonProps) => {
  console.log("Rendering Button: " + label);
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};

// Component with children
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}

// Self-closing JSX element
const Divider = () => <hr className="divider" />;

export { Button, Card, Divider };
