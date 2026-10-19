/**
 * Turning what a person typed into addresses the server accepts.
 *
 * Every screen that takes a list of people — starting a project, adding a class
 * roster — takes the same free text: one address per line, commas allowed, and a
 * name may sit in front of the address in angle brackets. The server accepts
 * either a bare address or `{email, name}`, so the parsing belongs in one place
 * rather than being re-guessed on each form.
 */

export type PersonInput = string | { email: string; name: string };

export function parsePeople(raw: string): PersonInput[] {
  return raw
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const angled = line.match(/^(.+?)\s*<([^>]+)>$/);
      if (angled) return { name: angled[1].trim(), email: angled[2].trim() };
      return line;
    });
}

/** The addresses in a parse, for counting and for saying who was skipped. */
export function personEmails(people: PersonInput[]): string[] {
  return people.map((person) => (typeof person === "string" ? person : person.email));
}