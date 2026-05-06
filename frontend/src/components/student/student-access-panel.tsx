"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, UserRoundPlus } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api/shared";
import { postJson } from "@/lib/api/client";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type StudentAccessPanelProps = {
  title: string;
  description: string;
};

type FieldKey =
  | "fullName"
  | "email"
  | "password"
  | "studentId"
  | "batch"
  | "department"
  | "section"
  | "newPassword";

type StudentAccessFieldErrors = Partial<Record<FieldKey, string>>;

type AccessMode = "register" | "login" | "forgot";

export function StudentAccessPanel({
  title,
  description,
}: StudentAccessPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AccessMode>("register");
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [batch, setBatch] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<StudentAccessFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const isBusy = isSubmitting;

  const options = useMemo(
    () => [
      { value: "register", label: "Create access", meta: "New student account" },
      { value: "login", label: "Sign in", meta: "Student ID + password" },
      { value: "forgot", label: "Forgot password", meta: "Reset via email" },
    ],
    [],
  );

  const clearFieldError = (field: FieldKey) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedFullName = fullName.trim();
    const normalizedEmail = email.trim();
    const trimmedStudentId = studentId.trim();
    const nextFieldErrors: StudentAccessFieldErrors = {};

    if (mode === "register") {
      if (trimmedFullName.length < 3) {
        nextFieldErrors.fullName = "Use at least 3 characters for your name.";
      }
      if (!trimmedStudentId) {
        nextFieldErrors.studentId = "Student ID is required.";
      }
      if (!batch.trim()) {
        nextFieldErrors.batch = "Batch is required.";
      }
      if (!department.trim()) {
        nextFieldErrors.department = "Department is required.";
      }
      if (!section.trim()) {
        nextFieldErrors.section = "Section is required.";
      }
      if (!normalizedEmail) {
        nextFieldErrors.email = "Email is required.";
      }
      if (password.length < 8) {
        nextFieldErrors.password = "Use at least 8 characters for your password.";
      }
    }

    if (mode === "login") {
      if (!trimmedStudentId) {
        nextFieldErrors.studentId = "Student ID is required.";
      }
      if (password.length < 8) {
        nextFieldErrors.password = "Use at least 8 characters for your password.";
      }
    }

    if (mode === "forgot") {
      if (!trimmedStudentId) {
        nextFieldErrors.studentId = "Student ID is required.";
      }
      if (!normalizedEmail) {
        nextFieldErrors.email = "Email is required to verify your identity.";
      }
      if (newPassword.length < 8) {
        nextFieldErrors.newPassword = "New password must be at least 8 characters.";
      }
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setErrorMessage("Please correct the highlighted fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setFieldErrors({});

      if (mode === "register") {
        await postJson("/auth/register", {
          fullName: trimmedFullName,
          studentId: trimmedStudentId,
          batch: batch.trim(),
          department: department.trim(),
          section: section.trim(),
          email: normalizedEmail,
          password,
        });
        setSuccessMessage("Student access created. Loading your private session...");
        setIsSubmitting(false);
        startTransition(() => {
          router.refresh();
        });
      } else if (mode === "login") {
        await postJson("/auth/login", {
          studentId: trimmedStudentId,
          password,
        });
        setSuccessMessage("Signed in successfully. Loading your private session...");
        setIsSubmitting(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        const result = await postJson<{ message: string }>("/auth/reset-password", {
          studentId: trimmedStudentId,
          email: normalizedEmail,
          newPassword,
        });
        setSuccessMessage(result.message);
        setIsSubmitting(false);
        setNewPassword("");
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to complete the request."));
      setIsSubmitting(false);
    }
  };

  const modeIcon =
    mode === "register" ? (
      <UserRoundPlus className="h-5 w-5" />
    ) : mode === "login" ? (
      <ShieldCheck className="h-5 w-5" />
    ) : (
      <KeyRound className="h-5 w-5" />
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
          {modeIcon}
        </div>
        <Badge variant="info" className="mt-4 w-fit">
          Student-owned access only
        </Badge>
        <CardTitle className="mt-3 text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SegmentedControl
          value={mode}
          onValueChange={(value) => {
            setMode(value as AccessMode);
            setErrorMessage(null);
            setSuccessMessage(null);
            setFieldErrors({});
          }}
          options={options}
        />
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          {/* ─── Register mode fields ─── */}
          {mode === "register" ? (
            <>
              <Field
                className="md:col-span-2"
                label="Full name"
                description="This becomes the student-owned profile name for registrations and complaints."
                error={fieldErrors.fullName}
              >
                <Input
                  value={fullName}
                  onChange={(event) => {
                    clearFieldError("fullName");
                    setFullName(event.target.value);
                  }}
                  placeholder="Enter your full name"
                  minLength={3}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  required
                />
              </Field>
              <Field
                label="Student ID"
                description="Your unique university student ID. Each ID can only register once."
                error={fieldErrors.studentId}
              >
                <Input
                  value={studentId}
                  onChange={(event) => {
                    clearFieldError("studentId");
                    setStudentId(event.target.value);
                  }}
                  placeholder="e.g. 2021-3-60-001"
                  aria-invalid={Boolean(fieldErrors.studentId)}
                  required
                />
              </Field>
              <Field label="Batch" description="Your intake batch number." error={fieldErrors.batch}>
                <Input
                  value={batch}
                  onChange={(event) => {
                    clearFieldError("batch");
                    setBatch(event.target.value);
                  }}
                  placeholder="e.g. 60"
                  aria-invalid={Boolean(fieldErrors.batch)}
                  required
                />
              </Field>
              <Field label="Department" description="Your department or program." error={fieldErrors.department}>
                <Input
                  value={department}
                  onChange={(event) => {
                    clearFieldError("department");
                    setDepartment(event.target.value);
                  }}
                  placeholder="e.g. CSE"
                  aria-invalid={Boolean(fieldErrors.department)}
                  required
                />
              </Field>
              <Field label="Section" description="Your class section." error={fieldErrors.section}>
                <Input
                  value={section}
                  onChange={(event) => {
                    clearFieldError("section");
                    setSection(event.target.value);
                  }}
                  placeholder="e.g. A"
                  aria-invalid={Boolean(fieldErrors.section)}
                  required
                />
              </Field>
              <Field label="Email" description="Your backend session is attached to this email." error={fieldErrors.email}>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    clearFieldError("email");
                    setEmail(event.target.value);
                  }}
                  placeholder="student@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  required
                />
              </Field>
              <Field
                className="md:col-span-2"
                label="Password"
                description="Use at least 8 characters."
                error={fieldErrors.password}
              >
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    clearFieldError("password");
                    setPassword(event.target.value);
                  }}
                  placeholder="Create a secure password"
                  minLength={8}
                  aria-invalid={Boolean(fieldErrors.password)}
                  required
                />
              </Field>
            </>
          ) : null}

          {/* ─── Login mode fields ─── */}
          {mode === "login" ? (
            <>
              <Field
                className="md:col-span-2"
                label="Student ID"
                description="Enter the Student ID you used when creating your account."
                error={fieldErrors.studentId}
              >
                <Input
                  value={studentId}
                  onChange={(event) => {
                    clearFieldError("studentId");
                    setStudentId(event.target.value);
                  }}
                  placeholder="e.g. 2021-3-60-001"
                  aria-invalid={Boolean(fieldErrors.studentId)}
                  required
                />
              </Field>
              <Field
                className="md:col-span-2"
                label="Password"
                description="Use at least 8 characters."
                error={fieldErrors.password}
              >
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    clearFieldError("password");
                    setPassword(event.target.value);
                  }}
                  placeholder="Enter your password"
                  minLength={8}
                  aria-invalid={Boolean(fieldErrors.password)}
                  required
                />
              </Field>
            </>
          ) : null}

          {/* ─── Forgot password mode fields ─── */}
          {mode === "forgot" ? (
            <>
              <Field
                className="md:col-span-2"
                label="Student ID"
                description="Enter the Student ID used when creating your account."
                error={fieldErrors.studentId}
              >
                <Input
                  value={studentId}
                  onChange={(event) => {
                    clearFieldError("studentId");
                    setStudentId(event.target.value);
                  }}
                  placeholder="e.g. 2021-3-60-001"
                  aria-invalid={Boolean(fieldErrors.studentId)}
                  required
                />
              </Field>
              <Field
                className="md:col-span-2"
                label="Registered email"
                description="We verify your identity by matching your Student ID with the email on file."
                error={fieldErrors.email}
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    clearFieldError("email");
                    setEmail(event.target.value);
                  }}
                  placeholder="student@example.com"
                  aria-invalid={Boolean(fieldErrors.email)}
                  required
                />
              </Field>
              <Field
                className="md:col-span-2"
                label="New password"
                description="Choose a new password (at least 8 characters)."
                error={fieldErrors.newPassword}
              >
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => {
                    clearFieldError("newPassword");
                    setNewPassword(event.target.value);
                  }}
                  placeholder="Enter your new password"
                  minLength={8}
                  aria-invalid={Boolean(fieldErrors.newPassword)}
                  required
                />
              </Field>
            </>
          ) : null}

          {errorMessage ? (
            <div className="md:col-span-2 rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
          {successMessage ? (
            <div className="md:col-span-2 rounded-[1rem] border border-success/15 bg-success-muted px-4 py-3 text-sm text-success">
              {successMessage}
            </div>
          ) : null}
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isBusy}>
              {isBusy
                ? mode === "register"
                  ? "Creating access..."
                  : mode === "login"
                    ? "Signing in..."
                    : "Resetting password..."
                : mode === "register"
                  ? "Create student access"
                  : mode === "login"
                    ? "Sign in"
                    : "Reset password"}
            </Button>
            <p className="text-sm leading-6 text-muted-foreground">
              {mode === "forgot"
                ? "Your identity is verified by matching Student ID with the email on record."
                : "Public event and summary pages remain accessible without signing in."}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
