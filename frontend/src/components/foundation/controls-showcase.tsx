"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CircleDashed,
  FileSearch,
  Inbox,
  LoaderCircle,
} from "lucide-react";

import {
  auditChecklist,
  controlShowcaseRows,
} from "@/features/foundation/data/demo-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { StatePanel } from "@/components/ui/state-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const tabs = [
  { value: "request", label: "Request form", meta: "Calm input hierarchy" },
  { value: "data", label: "Data table", meta: "Readable queue format" },
  { value: "states", label: "System states", meta: "Clear operating feedback" },
];

export function ControlsShowcase() {
  const [activeTab, setActiveTab] = useState("request");

  return (
    <div className="space-y-6">
      <SegmentedControl value={activeTab} onValueChange={setActiveTab} options={tabs} />

      {activeTab === "request" ? (
        <Card>
          <CardHeader>
            <Badge variant="info">Foundation pattern</Badge>
            <CardTitle className="mt-3">Request form composition</CardTitle>
            <CardDescription>
              Forms use one restrained visual language so finance, approvals, and
              complaints do not feel like separate products.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Field
              label="Event"
              description="Every financial record stays event-linked from the first field."
            >
              <Select
                defaultValue="demo-open-finance-workshop-2026"
                options={[
                  {
                    value: "demo-open-finance-workshop-2026",
                    label: "Demo Open Finance Workshop 2026",
                  },
                  {
                    value: "demo-cse-annual-tech-symposium-2026",
                    label: "Demo CSE Annual Tech Symposium 2026",
                  },
                ]}
              />
            </Field>
            <Field
              label="Request type"
              description="Internal actions signal workflow intent before reviewers open the record."
            >
              <Select
                defaultValue="budget"
                options={[
                  { value: "budget", label: "Budget request" },
                  { value: "expense", label: "Expense request" },
                  { value: "income", label: "Manual income note" },
                ]}
              />
            </Field>
            <Field
              label="Amount"
              description="Amounts stay prominent, but context stays nearby."
            >
              <Input defaultValue="1200.00" />
            </Field>
            <Field
              label="Evidence state"
              description="Storage details stay hidden while the presence of evidence stays visible."
            >
              <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-panel px-4 text-sm text-foreground shadow-sm">
                <Badge variant="success">Attached PDF</Badge>
                <span className="text-muted-foreground">
                  Two files linked without exposing paths
                </span>
              </div>
            </Field>
            <Field
              className="md:col-span-2"
              label="Context"
              description="Supporting notes are readable, but secondary to amount, status, and event linkage."
            >
              <Textarea
                rows={5}
                defaultValue="Banner, volunteer kits, and printed participation materials for the open workshop intake."
              />
            </Field>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <Button>Submit request</Button>
              <Button variant="outline">Save as draft</Button>
              <Badge variant="warning">Drafts never overwrite approved history</Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "data" ? (
        <Card>
          <CardHeader>
            <Badge variant="success">Queue readability</Badge>
            <CardTitle className="mt-3">Internal-ready data table</CardTitle>
            <CardDescription>
              Tables emphasize the signal that matters most first, then reveal rationale
              and state without becoming visually noisy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signal</TableHead>
                  <TableHead>Representation</TableHead>
                  <TableHead>Rationale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {controlShowcaseRows.map((row) => (
                  <TableRow key={row.signal}>
                    <TableCell className="font-semibold text-foreground">{row.signal}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{row.representation}</Badge>
                    </TableCell>
                    <TableCell className="max-w-lg text-muted-foreground">
                      {row.rationale}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {auditChecklist.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "states" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <StatePanel
            icon={Inbox}
            tone="empty"
            title="No records match the current filter"
            description="Empty states stay calm and explicit so users know the system is healthy, not broken."
          />
          <StatePanel
            icon={LoaderCircle}
            tone="loading"
            title="Rebuilding verification queue"
            description="Loading feedback explains what is happening instead of exposing a blank page."
          />
          <StatePanel
            icon={CircleDashed}
            tone="warning"
            title="Publish boundary still blocked"
            description="The event cannot publish a summary until reconciliation becomes finalized."
            action={<Badge variant="warning">Needs action</Badge>}
          />
          <StatePanel
            icon={AlertTriangle}
            tone="error"
            title="Protected evidence unavailable"
            description="Internal users get a clear error boundary when supporting files or metadata cannot be loaded."
            action={<Button variant="danger" size="sm">Retry secure fetch</Button>}
          />
          <StatePanel
            className="xl:col-span-2"
            icon={FileSearch}
            tone="success"
            title="Audit-ready view verified"
            description="Protected routes, review history, and public-safe shaping are aligned with the platform boundary."
            action={<Badge variant="success">Healthy posture</Badge>}
          />
        </div>
      ) : null}
    </div>
  );
}
