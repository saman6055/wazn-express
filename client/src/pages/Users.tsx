import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, Shield, User, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

const roleColors: Record<string, string> = {
  super_admin: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-200",
  admin: "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-200",
  employee: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200",
  accountant: "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200",
  user: "bg-gray-100 dark:bg-gray-950/40 text-gray-800 dark:text-gray-200",
};

const roleIcons: Record<string, React.ReactNode> = {
  super_admin: <Shield className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  employee: <UserCog className="h-3 w-3" />,
  accountant: <UserCog className="h-3 w-3" />,
  user: <User className="h-3 w-3" />,
};

export default function Users() {
    const { t, language } = useTranslation();
const [search, setSearch] = useState("");
  
  const { data: users, refetch } = trpc.users.list.useQuery();
  
  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userRoleUpdated"));
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const filteredUsers = users?.filter(user =>
    user.name?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Manage system users and their roles</p>
          </div>
        </div>

        {/* Role Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-600" />
                <div>
                  <div className="text-2xl font-bold">{users?.filter(u => u.role === "admin").length || 0}</div>
                  <div className="text-sm text-muted-foreground">Admins</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{users?.filter(u => u.role === "employee").length || 0}</div>
                  <div className="text-sm text-muted-foreground">Employees</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold">{users?.filter(u => u.role === "accountant").length || 0}</div>
                  <div className="text-sm text-muted-foreground">Accountants</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="text-2xl font-bold">{users?.filter(u => u.role === "accountant").length || 0}</div>
                  <div className="text-sm text-muted-foreground">{pickLang(language, { ku: "ژمێریار", en: "Accountants", ar: "المحاسبون", zh: "会计" })}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Login Method</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || "Unnamed"}</TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.loginMethod || "oauth"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                        {roleIcons[user.role]}
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.lastSignedIn).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={user.role}
                        onValueChange={(value) => updateRoleMutation.mutate({
                          userId: user.id,
                          role: value as "super_admin" | "admin" | "employee" | "accountant",
                        })}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="accountant">Accountant</SelectItem>

                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredUsers || filteredUsers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/40">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Role Permissions</p>
                <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">
                  <li><strong>Admin:</strong> Full system access, user management, settings</li>
                  <li><strong>Employee:</strong> Package management, customer service, basic operations</li>
                  <li><strong>Accountant:</strong> Financial operations, invoices, payments, reports</li>
                  <li><strong>User:</strong> Basic access only (typically for OAuth logins before role assignment)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
