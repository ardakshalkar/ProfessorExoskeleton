import { expectJson } from "./http.ts";
import { normalizeBaseUrl } from "./config.ts";
import type { FetchLike, MoodleProfile, Publication, PublishResult } from "./types.ts";

export function moodlePlan(profile: MoodleProfile, publication: Publication) {
  const courseId = publication.courseId ?? profile.courseId;
  if (!courseId) throw new Error("Moodle publication needs courseId in the publication or profile");
  if (!publication.content) throw new Error("Moodle publication needs content");
  if (publication.kind === "announcement" && !profile.wsFunction) {
    const forumId = publication.forumId ?? profile.forumId;
    if (!forumId) throw new Error("Moodle announcement needs forumId in the publication or profile");
    if (!publication.title) throw new Error("Moodle announcement needs title");
    return {
      method: "POST",
      path: "/webservice/rest/server.php",
      wsFunction: "mod_forum_add_discussion",
      apiStyle: "forum" as const,
      kind: publication.kind,
      title: publication.title,
      courseId,
      forumId,
    };
  }
  if (!profile.wsFunction) {
    throw new Error(`Moodle kind ${publication.kind} needs wsFunction in the profile`);
  }
  return {
    method: "POST",
    path: "/webservice/rest/server.php",
    wsFunction: profile.wsFunction,
    apiStyle: "custom" as const,
    kind: publication.kind,
    title: publication.title,
    courseId,
  };
}

export async function publishMoodle(profile: MoodleProfile, token: string, publication: Publication, fetcher: FetchLike = fetch): Promise<PublishResult> {
  const plan = moodlePlan(profile, publication);
  const baseParams = {
    wstoken: token,
    wsfunction: plan.wsFunction,
    moodlewsrestformat: "json",
  };
  const form = plan.apiStyle === "forum"
    ? new URLSearchParams({ ...baseParams, forumid: plan.forumId, subject: publication.title!, message: publication.content! })
    : new URLSearchParams({ ...baseParams, courseid: plan.courseId, title: publication.title ?? "", content: publication.content!, kind: publication.kind });
  const response = await fetcher(`${normalizeBaseUrl(profile.baseUrl)}${plan.path}`, { method: "POST", body: form });
  const body = await expectJson(response, "Moodle");
  if (body?.exception) throw new Error(`Moodle ${body.errorcode ?? "error"}: ${body.message ?? body.exception}`);
  return { provider: "moodle", id: String(body.discussionid ?? body.id ?? ""), url: body.url, raw: body };
}

export async function doctorMoodle(profile: MoodleProfile, token: string, fetcher: FetchLike = fetch): Promise<unknown> {
  const form = new URLSearchParams({ wstoken: token, wsfunction: "core_webservice_get_site_info", moodlewsrestformat: "json" });
  const response = await fetcher(`${normalizeBaseUrl(profile.baseUrl)}/webservice/rest/server.php`, { method: "POST", body: form });
  const body = await expectJson(response, "Moodle");
  if (body?.exception) throw new Error(`Moodle ${body.errorcode ?? "error"}: ${body.message ?? body.exception}`);
  return { provider: "moodle", ok: true, site: body.sitename ?? body.siteurl, user: body.fullname ?? body.username };
}
