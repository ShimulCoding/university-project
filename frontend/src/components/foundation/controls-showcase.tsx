"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Database,
  FileCheck,
  FileSearch,
  FileText,
  Inbox,
  LayoutGrid,
  LoaderCircle,
  Settings,
  ShieldCheck,
  Clock,
  Ban
} from "lucide-react";

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
  { value: "request", label: "Form Layouts", meta: "Standardized input hierarchy" },
  { value: "data", label: "Data Grids", meta: "Optimized for administrative review" },
  { value: "states", label: "System Feedback", meta: "Clear operational states" },
];

const controlShowcaseRows = [
  {
    signal: "Submission Status",
    representation: "Pending Approval",
    rationale: "Clearly indicates that the record is locked for review and awaits administrative action.",
  },
  {
    signal: "Attachment Integrity",
    representation: "Verified Document",
    rationale: "Confirms the presence of supporting files without exposing sensitive underlying storage paths.",
  },
  {
    signal: "Publication Gateway",
    representation: "Restricted",
    rationale: "Ensures data remains internal until all compliance and reconciliation checks are complete.",
  },
];

const auditChecklist = [
  "Consistent layout hierarchy minimizes cognitive load during complex reviews.",
  "State indicators clearly differentiate between actionable, blocked, and completed tasks.",
  "Data grids prioritize key signals (dates, amounts, status) over secondary metadata.",
  "Responsive components adapt seamlessly across varying screen sizes and devices.",
];

export function ControlsShowcase() {
  const [activeTab, setActiveTab] = useState("request");

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <SegmentedControl value={activeTab} onValueChange={setActiveTab} options={tabs} />
      </div>

      {activeTab === "request" ? (
        <Card className="border-border/40 shadow-sm bg-background/40 backdrop-blur-xl overflow-hidden">
          <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="neutral" className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                Interface Pattern
              </Badge>
            </div>
            <CardTitle className="text-2xl tracking-tight">Standardized Form Layout</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Our form components utilize a consistent, highly readable structure. This ensures data entry and review processes—whether for budgets, events, or compliance—feel unified and intuitive.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 grid gap-6 md:grid-cols-2">
            <Field
              label="Associated Department"
              description="Link this record to its corresponding organizational unit."
            >
              <Select
                defaultValue="academic-affairs"
                options={[
                  { value: "academic-affairs", label: "Department of Academic Affairs" },
                  { value: "finance", label: "University Finance Office" },
                  { value: "student-services", label: "Student Services Division" }
                ]}
              />
            </Field>
            <Field
              label="Transaction Classification"
              description="Specify the nature of the financial or operational request."
            >
              <Select
                defaultValue="procurement"
                options={[
                  { value: "procurement", label: "Equipment Procurement" },
                  { value: "reimbursement", label: "Travel Reimbursement" },
                  { value: "allocation", label: "Fund Allocation" },
                ]}
              />
            </Field>
            <Field
              label="Requested Amount (USD)"
              description="Enter the precise financial figure associated with this record."
            >
              <Input defaultValue="4,500.00" />
            </Field>
            <Field
              label="Supporting Documentation"
              description="Upload relevant invoices, receipts, or policy approvals."
            >
              <div className="flex h-11 items-center gap-3 rounded-lg border border-border bg-background px-4 text-sm text-foreground shadow-sm">
                <Badge variant="neutral" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                  <FileCheck className="w-3.5 h-3.5 mr-1" />
                  Verified
                </Badge>
                <span className="text-muted-foreground font-medium">
                  vendor_invoice_Q3.pdf
                </span>
              </div>
            </Field>
            <Field
              className="md:col-span-2"
              label="Justification / Notes"
              description="Provide comprehensive context to expedite the review process."
            >
              <Textarea
                rows={4}
                className="resize-none"
                defaultValue="Requested funds cover the procurement of 15 new laboratory workstations for the upcoming fall semester."
              />
            </Field>
            <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border/40 mt-2">
              <Button variant="outline" className="text-muted-foreground">Cancel</Button>
              <Button variant="secondary">Save Draft</Button>
              <Button>Submit for Review</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "data" ? (
        <Card className="border-border/40 shadow-sm bg-background/40 backdrop-blur-xl overflow-hidden">
          <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="neutral" className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                Data Representation
              </Badge>
            </div>
            <CardTitle className="text-2xl tracking-tight">Administrative Data Grids</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Tables are designed to surface critical decision-making signals immediately, reducing visual clutter while keeping deep context accessible.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Information Signal</TableHead>
                  <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Visual Treatment</TableHead>
                  <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Design Rationale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {controlShowcaseRows.map((row) => (
                  <TableRow key={row.signal} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground px-6 py-4">{row.signal}</TableCell>
                    <TableCell>
                      <Badge variant="neutral" className="shadow-sm">{row.representation}</Badge>
                    </TableCell>
                    <TableCell className="max-w-lg text-muted-foreground text-sm leading-relaxed">
                      {row.rationale}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-6 md:p-8 bg-muted/5 border-t border-border/30">
              <h4 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Design Guidelines
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                {auditChecklist.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary/70 shrink-0 mt-0.5" />
                    <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "states" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-border/40 shadow-sm bg-background/50 overflow-hidden h-full flex flex-col justify-center py-8">
            <StatePanel
              icon={Inbox}
              tone="empty"
              title="No Pending Records"
              description="The queue is currently clear. Any new submissions requiring your attention will appear here."
            />
          </Card>
          
          <Card className="border-border/40 shadow-sm bg-background/50 overflow-hidden h-full flex flex-col justify-center py-8">
            <StatePanel
              icon={LoaderCircle}
              tone="loading"
              title="Synchronizing Data"
              description="Securely retrieving the latest institutional records from the central database..."
            />
          </Card>

          <Card className="border-border/40 shadow-sm bg-background/50 overflow-hidden h-full flex flex-col justify-center py-8 border-l-4 border-l-warning">
            <StatePanel
              icon={Clock}
              tone="warning"
              title="Review Period Expiring"
              description="Several department budgets have not been finalized and are approaching the submission deadline."
              action={<Button variant="outline" size="sm" className="mt-2 text-warning hover:text-warning/80">View Pending Budgets</Button>}
            />
          </Card>

          <Card className="border-border/40 shadow-sm bg-background/50 overflow-hidden h-full flex flex-col justify-center py-8 border-l-4 border-l-destructive">
            <StatePanel
              icon={Ban}
              tone="error"
              title="Access Restricted"
              description="Your current role does not grant permission to view or modify high-level university financial policies."
              action={<Button variant="secondary" size="sm" className="mt-2">Request Access</Button>}
            />
          </Card>

          <Card className="xl:col-span-2 border-primary/20 shadow-sm bg-primary/5 overflow-hidden py-8">
            <StatePanel
              icon={ShieldCheck}
              tone="success"
              title="System Healthy & Audited"
              description="All background processes, security protocols, and data synchronization services are operating optimally."
              action={<Badge variant="neutral" className="bg-background text-foreground mt-2 shadow-sm border-border/50">Last Checked: Just Now</Badge>}
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}