"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface FreelancehuntProjectView {
  id: number;
  name: string;
  description: string | null;
  url: string;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  skills: string[];
  discoveredAt: string;
}

export function FreelancehuntProjects({ projects }: { projects: FreelancehuntProjectView[] }) {
  if (projects.length === 0) return <Card className="border-dashed"><CardContent className="py-8 text-sm text-muted-foreground">No projects saved yet. Enable Freelancehunt monitoring in Settings to begin.</CardContent></Card>;
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>;
}

function ProjectCard({ project }: { project: FreelancehuntProjectView }) {
  const [open, setOpen] = useState(false);
  const budget = project.budgetAmount === null ? "Budget not specified" : `${project.budgetAmount.toLocaleString("en-US")} ${project.budgetCurrency ?? ""}`;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<button type="button" className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />}><Card className="h-full transition-colors hover:border-primary/40"><CardHeader className="pb-2"><CardTitle className="line-clamp-2 text-base">{project.name}</CardTitle><CardDescription>{budget}</CardDescription></CardHeader><CardContent><p className="line-clamp-3 text-sm text-muted-foreground">{project.description ?? "No description available."}</p><p className="mt-3 line-clamp-1 text-xs text-muted-foreground">{project.skills.join(", ") || "No skills listed"}</p></CardContent></Card></DialogTrigger>
    <DialogContent className="dark dashboard-dialog max-h-[calc(100vh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"><DialogHeader><DialogTitle className="pr-7 leading-snug">{project.name}</DialogTitle><DialogDescription>{budget} · Discovered {new Date(project.discoveredAt).toLocaleString("en-US")}</DialogDescription></DialogHeader><div className="whitespace-pre-wrap leading-6">{project.description ?? "No description available."}</div><div><h3 className="mb-2 font-medium">Skills</h3><div className="flex flex-wrap gap-2">{project.skills.length ? project.skills.map((skill) => <span key={skill} className="rounded-full bg-muted px-2.5 py-1 text-xs">{skill}</span>) : <span className="text-sm text-muted-foreground">No skills listed</span>}</div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Close</Button><Button render={<a href={project.url} target="_blank" rel="noreferrer" />}>Open on Freelancehunt</Button></DialogFooter></DialogContent>
  </Dialog>;
}
