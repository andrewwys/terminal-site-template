/** Where the Studio (the in-browser editor, see src/studio/) runs, and the link to edit a repo in it. */
export const STUDIO_URL = "https://studio.andrewwy.com/";

/** The Studio, opened on `repo` ("owner/name") if given. */
export const studioLink = (repo?: string): string => (repo ? `${STUDIO_URL}#/${repo}` : STUDIO_URL);
