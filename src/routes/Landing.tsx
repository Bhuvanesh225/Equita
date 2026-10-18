/**
 * The landing page.
 *
 * Nine sections, in one deliberate order, and only one of them is about the
 * product in the abstract. The rest are the demonstration dataset — the three groups
 * at different stages of going wrong or going right, the score broken into its
 * five parts, and the class register. Every number is computed on request by the
 * same engines the application runs, so the page cannot overstate the product
 * without the dataset contradicting it.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { useApi } from "../lib/live";
import { useSession } from "../lib/session";
import { Hero, Masthead } from "./landing/Hero";
import { Capabilities, Scoring, Teachers } from "./landing/Sections";
import { Back, Moments, Questions, Reply, Roll, Tickets } from "./landing/SectionsB";
import { buildQuestions } from "./landing/story";
import type { Story } from "./landing/types";

/**
 * Arm and run the scroll reveal.
 *
 * The stylesheet only hides what this has explicitly armed, so if the script
 * never runs — an old browser, an error earlier in the tree — the page is fully
 * readable rather than blank. Revealing is decoration; it is never load-bearing.
 */
function useReveal(ready: boolean) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === "undefined") return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!nodes.length) return;

    root.setAttribute("data-armed", "true");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-seen", "true");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "-5% 0px -10% 0px" },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [ready]);

  return rootRef;
}

export default function Landing() {
  const { user } = useSession();
  const { data: story } = useApi<Story>("/api/public/story", { live: false });
  const rootRef = useReveal(!!story);
  const [openQuestion, setOpenQuestion] = useState(0);

  const situations = story?.situations ?? [];

  /** The evenly-split group, as one bar. Used in sheet 03 and in the teacher view. */
  const shareSegments = useMemo(() => {
    const group = situations.find((situation) => situation.key === "working") ?? situations[0];
    if (!group) return [];
    return group.members.map((member) => ({
      id: member.fullName,
      name: member.name,
      hue: member.hue,
      hours: member.delivered,
    }));
  }, [situations]);

  const questions = useMemo(() => buildQuestions(situations), [story, situations]);

  return (
    <div className="land" ref={rootRef}>
      <Masthead signedIn={!!user} />

      <Hero story={story ?? null} signedIn={!!user} />
      <Scoring situations={situations} />
      <Capabilities situations={situations} shareSegments={shareSegments} />
      <Teachers story={story ?? null} shareSegments={shareSegments} />
      <Moments />
      <Roll story={story ?? null} />
      <Tickets />
      <Questions questions={questions} open={openQuestion} onOpen={setOpenQuestion} />
      <Reply signedIn={!!user} />
      <Back />
    </div>
  );
}
