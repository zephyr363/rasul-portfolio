import { motion } from "motion/react";
import type { Experience, SkillGroup } from "~/shared/types";
const month = (value: string) =>
  new Date(value).toLocaleDateString("ru-RU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export function Career({ items }: { items: Experience[] }) {
  return (
    <div className="career-list">
      {items.map((item, i) => (
        <motion.article
          key={item.id}
          className="career-item"
          initial={false}
          whileInView={{ y: 0 }}
          viewport={{ once: true }}
        >
          <div className="career-date">
            <span className="eyebrow">0{i + 1}</span>
            <p>
              {month(item.start)} —<br />
              {item.end ? month(item.end) : "настоящее время"}
            </p>
          </div>
          <div className="career-role">
            <h3>{item.role}</h3>
            <p>{item.company}</p>
            {item.city && <span>{item.city}</span>}
          </div>
          <ul>
            {item.description
              .split("\n")
              .filter(Boolean)
              .map((line) => (
                <li key={line}>{line}</li>
              ))}
          </ul>
        </motion.article>
      ))}
    </div>
  );
}
export function Skills({ groups }: { groups: SkillGroup[] }) {
  return (
    <div className="skill-grid">
      {groups.map((group, i) => (
        <article className="skill-group" key={group.id}>
          <div className="skill-heading">
            <span className="eyebrow">0{i + 1}</span>
            <h3>{group.title}</h3>
          </div>
          <div className="skill-tags">
            {group.skills.split(",").map((skill) => (
              <span key={skill}>{skill.trim()}</span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
