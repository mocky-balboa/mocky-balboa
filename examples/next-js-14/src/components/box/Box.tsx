import { CSSProperties } from "react";

export const Box = ({
  children,
  ...cssProperties
}: { children: React.ReactNode } & CSSProperties) => {
  return (
    <div className="box" style={cssProperties}>
      {children}
    </div>
  );
};
