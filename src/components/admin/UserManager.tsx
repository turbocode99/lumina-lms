"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Search, UserPlus, UserCog } from "lucide-react";

import {
  inviteUserAction,
  resetUserPasswordAction,
  updateUserAction,
  type ActionState,
} from "@/app/actions/admin";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ROLES } from "@/lib/enums";
import { cn, formatDate } from "@/lib/utils";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  department: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  _count: { enrollments: number; certificates: number };
}

const initialState: ActionState = {};

function PendingButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      {label}
    </Button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.errors?._form) {
    return (
      <p role="alert" className="text-sm text-[var(--danger)]">
        {state.errors._form}
      </p>
    );
  }
  if (state.ok) {
    return <p className="text-sm text-[var(--success)]">{state.message}</p>;
  }
  return null;
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [state, formAction] = useActionState(inviteUserAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Feedback state={state} />

      <Input
        name="name"
        label="Full name"
        placeholder="Ada Lovelace"
        error={state.errors?.name}
        required
      />
      <Input
        name="email"
        type="email"
        label="Work email"
        placeholder="ada@company.com"
        error={state.errors?.email}
        required
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          name="title"
          label="Job title"
          placeholder="Staff Engineer"
          error={state.errors?.title}
        />
        <Input
          name="department"
          label="Department"
          placeholder="Engineering"
          error={state.errors?.department}
        />
      </div>

      <Select name="role" label="Role" defaultValue="LEARNER">
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role.charAt(0) + role.slice(1).toLowerCase()}
          </option>
        ))}
      </Select>

      <Input
        name="password"
        type="password"
        label="Temporary password"
        error={state.errors?.password}
        hint="Share this with them securely. They can change it from their profile."
        required
      />

      <div className="flex gap-3">
        <PendingButton label="Create account" />
        <Button type="button" onClick={onDone}>
          Close
        </Button>
      </div>
    </form>
  );
}

function EditForm({ user, onDone }: { user: ManagedUser; onDone: () => void }) {
  const [state, formAction] = useActionState(updateUserAction, initialState);
  const [resetState, resetAction] = useActionState(
    resetUserPasswordAction,
    initialState
  );

  return (
    <div className="space-y-7">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="userId" value={user.id} />
        <Feedback state={state} />

        <Select name="role" label="Role" defaultValue={user.role} error={state.errors?.role}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role.charAt(0) + role.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            name="title"
            label="Job title"
            defaultValue={user.title ?? ""}
            error={state.errors?.title}
          />
          <Input
            name="department"
            label="Department"
            defaultValue={user.department ?? ""}
            error={state.errors?.department}
          />
        </div>

        <div className="neu-inset rounded-2xl p-4">
          <Checkbox
            name="isActive"
            defaultChecked={user.isActive}
            label="Account is active"
            description="Deactivating blocks sign-in immediately without deleting any progress."
          />
          {state.errors?.isActive && (
            <p className="mt-2 text-xs text-[var(--danger)]">
              {state.errors.isActive}
            </p>
          )}
        </div>

        <PendingButton label="Save changes" />
      </form>

      <div className="border-t border-[var(--border-subtle)] pt-6">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
          <KeyRound className="h-4 w-4 text-[var(--accent)]" />
          Reset password
        </h3>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Sets a new password directly. They&apos;ll get a notification.
        </p>

        <form action={resetAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          <Feedback state={resetState} />
          <Input
            name="password"
            type="password"
            label="New password"
            error={resetState.errors?.password}
            required
          />
          <PendingButton label="Reset password" />
        </form>
      </div>

      <div className="flex justify-end border-t border-[var(--border-subtle)] pt-5">
        <Button onClick={onDone}>Close</Button>
      </div>
    </div>
  );
}

export function UserManager({
  users,
  initialRole = "",
  initialStatus = "",
}: {
  users: ManagedUser[];
  /** Seeded from the URL so admin tiles can deep link to a filtered view. */
  initialRole?: string;
  initialStatus?: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(initialRole);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (statusFilter === "active" && !user.isActive) return false;
      if (statusFilter === "inactive" && user.isActive) return false;
      if (!needle) return true;
      return (
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        (user.department ?? "").toLowerCase().includes(needle) ||
        (user.title ?? "").toLowerCase().includes(needle)
      );
    });
  }, [users, query, roleFilter, statusFilter]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div data-tour="admin-users-filters" className="flex flex-wrap items-center gap-3">
        <div className="neu-inset neu-input flex min-w-[240px] flex-1 items-center gap-2.5 rounded-2xl px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or department…"
            aria-label="Search people"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="neu-inset neu-input flex items-center rounded-2xl px-4 py-3">
          <label htmlFor="role-filter" className="sr-only">
            Filter by role
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="cursor-pointer bg-transparent text-sm outline-none [&>option]:bg-[var(--surface)]"
          >
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0) + role.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="neu-inset neu-input flex items-center rounded-2xl px-4 py-3">
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="cursor-pointer bg-transparent text-sm outline-none [&>option]:bg-[var(--surface)]"
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <Button
          onClick={() => setInviting(true)}
          variant="primary"
          data-tour="admin-users-add"
        >
          <UserPlus className="h-4 w-4" />
          Add person
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-[var(--text-muted)]">
          {filtered.length} of {users.length} people
        </p>
        {(roleFilter || statusFilter || query) && (
          <Button
            size="sm"
            onClick={() => {
              setRoleFilter("");
              setStatusFilter("");
              setQuery("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card padded={false} className="overflow-hidden" data-tour="admin-users-table">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left">
                {["Person", "Role", "Department", "Learning", "Last seen", ""].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className={cn(
                    "border-b border-[var(--border-subtle)] transition-colors last:border-0 hover:bg-[var(--surface-raised)]",
                    !user.isActive && "opacity-55"
                  )}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--text-primary)]">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={user.role} />
                      {!user.isActive && <Badge tone="danger">Inactive</Badge>}
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <p className="text-[var(--text-secondary)]">
                      {user.department ?? "—"}
                    </p>
                    {user.title && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {user.title}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">
                    {user._count.enrollments} enrolled
                    <br />
                    {user._count.certificates} certificates
                  </td>

                  <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <Button size="sm" onClick={() => setEditing(user)}>
                      <UserCog className="h-3.5 w-3.5" />
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center text-[var(--text-muted)]"
                  >
                    No one matches those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Add a person"
        description="Creates an account directly. They can sign in straight away."
      >
        <InviteForm onDone={() => setInviting(false)} />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Manage ${editing.name}` : ""}
        description={editing?.email}
      >
        {editing && <EditForm user={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

export default UserManager;
