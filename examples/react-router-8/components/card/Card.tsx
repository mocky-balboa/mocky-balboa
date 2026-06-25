import styles from "./card.module.css";

export type CardType = "primary" | "danger";

export const Card = ({
  children,
  type = "primary",
}: {
  children: React.ReactNode;
  type?: CardType;
}) => {
  return (
    <div className={[styles.card, styles[`card-${type}`]].join(" ")}>
      {children}
    </div>
  );
};
