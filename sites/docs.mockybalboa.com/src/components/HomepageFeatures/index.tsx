import type { ReactNode } from "react";
import clsx from "clsx";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  emoji: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Seamless Integration",
    emoji: "🥊",
    description: (
      <>
        Mock network requests on your server-side application without altering
        your app logic.
      </>
    ),
  },
  {
    title: "Your Stack, Your Way",
    emoji: "⚙️",
    description: (
      <>
        Mocky-Balboa adapts to your stack, not the other way around. It's the
        single tool you'll need to deliver reliable server-side mocks to any SSR
        framework or browser automation tool.
      </>
    ),
  },
  {
    title: "Full-Stack Control",
    emoji: "🚀",
    description: (
      <>Intercept server-side and client-side requests from a single source.</>
    ),
  },
];

function Feature({ title, emoji, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <div className={clsx("text--center", styles.featureEmoji)}>
        <p>{emoji}</p>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
