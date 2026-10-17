import type { FreelancehuntSkill } from "@home-dashboard/integrations";

// Catalogue reuse is confined to this browser module, never a user's credentials.
// Filtering/pagination does not cause further upstream catalogue requests.
let catalogue: Promise<FreelancehuntSkill[]> | undefined;
export function loadFreelancehuntCatalogue() {
  if (!catalogue) catalogue = fetch("/api/freelancehunt/skills").then(async (response) => {
    if (!response.ok) throw new Error("catalogue_unavailable");
    return await response.json() as FreelancehuntSkill[];
  }).catch((error) => { catalogue = undefined; throw error; });
  return catalogue;
}
