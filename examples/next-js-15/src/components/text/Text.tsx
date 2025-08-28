import { CSSProperties } from "react";
import styles from "./text.module.css";

export const Text = ({
  children,
  ...cssProperties
}: {
  children: React.ReactNode;
} & Pick<CSSProperties, "textAlign" | "fontWeight" | "color">) => {
  return (
    <p className={styles.text} style={cssProperties}>
      {children}
    </p>
  );
};
