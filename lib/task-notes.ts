export interface TaskNotes {
  text: string;
  photos: string[];
  afterPhotos: string[];
  /** Stored JSON is kept verbatim so editing a task cannot discard its analysis. */
  analysis: string | null;
}

function isPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Read the existing Notes attachment format without exposing it in the notes editor. */
export function parseTaskNotes(raw: string | null | undefined): TaskNotes {
  const result: TaskNotes = { text: "", photos: [], afterPhotos: [], analysis: null };
  if (!raw) return result;
  const sections = [...raw.matchAll(/(?:^|\n)(Photos:|After photo:|AI Analysis:)[ \t]*/g)];
  if (!sections.length) return { ...result, text: raw.trim() };
  const text = [raw.slice(0, sections[0].index).trim()];
  sections.forEach((section, index) => {
    const start = section.index! + section[0].length;
    const end = sections[index + 1]?.index ?? raw.length;
    const content = raw.slice(start, end).trim();
    if (section[1] === "AI Analysis:") {
      result.analysis = content || null;
      return;
    }
    const attachmentUrls: string[] = [];
    const otherLines: string[] = [];
    for (const line of content.split("\n")) {
      const value = line.trim();
      if (isPhotoUrl(value)) attachmentUrls.push(value);
      else if (value) otherLines.push(line);
    }
    if (section[1] === "Photos:") result.photos.push(...attachmentUrls);
    else result.afterPhotos.push(...attachmentUrls);
    // Preserve any manually written text following a photo section.
    if (otherLines.length) text.push(otherLines.join("\n"));
  });
  result.text = text.filter(Boolean).join("\n\n");
  result.photos = [...new Set(result.photos)];
  result.afterPhotos = [...new Set(result.afterPhotos)];
  return result;
}

export function serializeTaskNotes(parts: TaskNotes): string {
  const sections = [parts.text.trim()];
  const photos = [...new Set(parts.photos)];
  if (photos.length) sections.push(`Photos:\n${photos.join("\n")}`);
  for (const url of [...new Set(parts.afterPhotos)]) sections.push(`After photo: ${url}`);
  if (parts.analysis) sections.push(`AI Analysis:\n${parts.analysis}`);
  return sections.filter(Boolean).join("\n\n");
}
