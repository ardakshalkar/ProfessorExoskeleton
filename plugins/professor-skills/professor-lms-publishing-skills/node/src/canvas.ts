import { expectJson } from "./http.ts";
import { normalizeBaseUrl } from "./config.ts";
import type { CanvasProfile, FetchLike, Publication, PublishResult } from "./types.ts";

export function canvasPlan(profile: CanvasProfile, publication: Publication) {
  const courseId = publication.courseId ?? profile.courseId;
  if (!courseId) throw new Error("Canvas publication needs courseId in the publication or profile");
  if (publication.kind === "announcement") {
    if (!publication.title || !publication.content) throw new Error("Canvas announcement needs title and content");
    return { method: "POST", path: `/api/v1/courses/${encodeURIComponent(courseId)}/discussion_topics`, kind: publication.kind, title: publication.title, courseId };
  }
  if (publication.kind === "page") {
    if (!publication.title || !publication.content) throw new Error("Canvas page needs title and content");
    return { method: "POST", path: `/api/v1/courses/${encodeURIComponent(courseId)}/pages`, kind: publication.kind, title: publication.title, courseId, published: publication.published ?? true };
  }
  throw new Error(`Canvas does not support publication kind ${publication.kind}`);
}

export async function publishCanvas(profile: CanvasProfile, token: string, publication: Publication, fetcher: FetchLike = fetch): Promise<PublishResult> {
  const plan = canvasPlan(profile, publication);
  const form = new URLSearchParams();
  if (publication.kind === "announcement") {
    form.set("title", publication.title!);
    form.set("message", publication.content!);
    form.set("is_announcement", "true");
    form.set("published", "true");
  } else {
    form.set("wiki_page[title]", publication.title!);
    form.set("wiki_page[body]", publication.content!);
    form.set("wiki_page[published]", String(publication.published ?? true));
  }
  const response = await fetcher(normalizeBaseUrl(profile.baseUrl) + plan.path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const body = await expectJson(response, "Canvas");
  return { provider: "canvas", id: String(body.id ?? body.page_id ?? ""), url: body.html_url, raw: body };
}

export async function doctorCanvas(profile: CanvasProfile, token: string, fetcher: FetchLike = fetch): Promise<unknown> {
  const response = await fetcher(`${normalizeBaseUrl(profile.baseUrl)}/api/v1/users/self/profile`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await expectJson(response, "Canvas");
  return { provider: "canvas", ok: true, user: body.name ?? body.login_id ?? body.id };
}
