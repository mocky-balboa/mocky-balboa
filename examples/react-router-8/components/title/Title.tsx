import styles from "./title.module.css";

export interface TitleProps {
  content: {
    text: string;
    highlight?: boolean;
  }[];
}

export const Title = ({ content }: TitleProps) => {
  return (
    <h1 className={styles.title}>
      {content.map((item, index) => (
        <span key={index} className={item.highlight ? styles.highlighted : ""}>
          {item.text}
        </span>
      ))}
    </h1>
  );
};
