/**
 * Google Tag Manager API service wrapper (READ-ONLY by design).
 *
 * This version inspects and recommends only — it never creates, mutates, or
 * publishes container changes. (A future "apply" mode would require write
 * scopes + an explicit user confirmation flow.)
 *
 * Demo mode injects DEMO_GTM upstream.
 */

import type { GtmSnapshot, GtmTag, GtmTrigger, GtmVariable } from "@/lib/types";

const BASE = "https://www.googleapis.com/tagmanager/v2";

function authHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

async function get(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`${BASE}/${path}`, { headers: authHeaders(accessToken) });
  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (!res.ok) throw new Error(`GTM API error ${res.status} on ${path}`);
  return res.json();
}

export function createGtmService(accessToken: string) {
  return {
    async listAccounts() {
      const data = await get("accounts", accessToken);
      return (data.account ?? []).map((a: any) => ({ accountId: a.accountId, name: a.name }));
    },
    async listContainers(accountId: string) {
      const data = await get(`accounts/${accountId}/containers`, accessToken);
      return (data.container ?? []).map((c: any) => ({
        containerId: c.containerId,
        name: c.name,
        publicId: c.publicId,
      }));
    },
    async listWorkspaces(accountId: string, containerId: string) {
      const data = await get(
        `accounts/${accountId}/containers/${containerId}/workspaces`,
        accessToken,
      );
      return (data.workspace ?? []).map((w: any) => ({ workspaceId: w.workspaceId, name: w.name }));
    },

    /** Pull the full container snapshot and analyze it for tracking gaps. */
    async inspect(accountId: string, containerId: string, workspaceId: string): Promise<GtmSnapshot> {
      const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
      const [tagsData, triggersData, varsData, builtInData] = await Promise.all([
        get(`${parent}/tags`, accessToken),
        get(`${parent}/triggers`, accessToken),
        get(`${parent}/variables`, accessToken),
        get(`${parent}/built_in_variables`, accessToken),
      ]);

      const tags: GtmTag[] = (tagsData.tag ?? []).map((t: any) => ({
        tagId: t.tagId,
        name: t.name,
        type: t.type,
        firingTriggerIds: t.firingTriggerId ?? [],
      }));
      const triggers: GtmTrigger[] = (triggersData.trigger ?? []).map((t: any) => ({
        triggerId: t.triggerId,
        name: t.name,
        type: t.type,
      }));
      const variables: GtmVariable[] = (varsData.variable ?? []).map((v: any) => ({
        variableId: v.variableId,
        name: v.name,
        type: v.type,
      }));
      const builtInVariables: string[] = (builtInData.builtInVariable ?? []).map(
        (b: any) => b.name ?? b.type,
      );

      return {
        accountId,
        containerId,
        workspaceId,
        tags,
        triggers,
        variables,
        builtInVariables,
        detectedTrackingIssues: analyzeGtm(tags, triggers, builtInVariables),
      };
    },
  };
}

/**
 * Static analysis of a container for common tracking gaps. The audit engine
 * recomputes scoring from the raw snapshot too; this provides a quick summary.
 */
export function analyzeGtm(
  tags: GtmTag[],
  triggers: GtmTrigger[],
  builtInVariables: string[],
): string[] {
  const issues: string[] = [];
  const tagTypes = tags.map((t) => t.type.toLowerCase());
  const triggerTypes = triggers.map((t) => t.type.toLowerCase());

  if (!tagTypes.some((t) => t.includes("gaawc"))) {
    issues.push("No GA4 configuration tag found.");
  }
  if (!tagTypes.some((t) => t.includes("awct"))) {
    issues.push("No Google Ads conversion tag found — paid conversions can't be imported for bidding.");
  }
  if (!triggerTypes.some((t) => t.includes("form"))) {
    issues.push("No form-submission trigger — form fills are untracked.");
  }
  if (!triggerTypes.some((t) => t.includes("click"))) {
    issues.push("No click trigger — phone-click / button-click conversions are untracked.");
  }
  if (!builtInVariables.some((v) => /click/i.test(v))) {
    issues.push("Click-based built-in variables (Click URL/Text) are not enabled.");
  }
  // Tags without firing triggers.
  const orphanTags = tags.filter((t) => t.firingTriggerIds.length === 0);
  if (orphanTags.length > 0) {
    issues.push(`${orphanTags.length} tag(s) have no firing trigger and will never fire.`);
  }
  // Duplicate Ads conversion tags.
  const adsConv = tagTypes.filter((t) => t.includes("awct")).length;
  if (adsConv > 1) {
    issues.push("Multiple Google Ads conversion tags — risk of double-counting conversions.");
  }
  // Overly broad triggers (All Pages firing conversion-type tags).
  const allPages = triggers.find((t) => /all pages/i.test(t.name));
  if (allPages && tags.some((tg) => tg.firingTriggerIds.includes(allPages.triggerId) && tg.type.toLowerCase().includes("awct"))) {
    issues.push("A conversion tag fires on All Pages — likely too broad (inflated conversions).");
  }
  return issues;
}
