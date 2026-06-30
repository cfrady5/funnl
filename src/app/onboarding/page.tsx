import { AlertCircle } from "lucide-react";
import { AppShell } from "@/components/nav/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth";
import { saveOnboardingAction } from "@/app/actions";
import { DEMO_MODE } from "@/lib/config";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  const { error } = await searchParams;

  return (
    <AppShell demoMode={DEMO_MODE} userEmail={user?.email}>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Tell us about your business
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This sharpens your audit recommendations.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form action={saveOnboardingAction} className="space-y-6">
          {/* Business basics */}
          <Card>
            <CardHeader>
              <CardTitle>Business basics</CardTitle>
              <CardDescription>
                Where you operate and what you spend.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="businessName">
                  Business name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="businessName"
                  name="businessName"
                  required
                  placeholder="Acme Lawn Care"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="websiteUrl">
                  Website URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="websiteUrl"
                  name="websiteUrl"
                  type="url"
                  required
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  name="industry"
                  placeholder="Home services"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryLocation">Primary location</Label>
                <Input
                  id="primaryLocation"
                  name="primaryLocation"
                  placeholder="West Lafayette, Indiana"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="serviceArea">Service area</Label>
                <Input
                  id="serviceArea"
                  name="serviceArea"
                  placeholder="Greater Lafayette & Tippecanoe County"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyAdBudget">Monthly ad budget</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="monthlyAdBudget"
                    name="monthlyAdBudget"
                    type="number"
                    min={0}
                    step={100}
                    placeholder="5000"
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyMarketingBudget">
                  Monthly marketing budget
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="monthlyMarketingBudget"
                    name="monthlyMarketingBudget"
                    type="number"
                    min={0}
                    step={100}
                    placeholder="3000"
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="averageCustomerValue">
                  Average customer value
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="averageCustomerValue"
                    name="averageCustomerValue"
                    type="number"
                    min={0}
                    step={50}
                    placeholder="1200"
                    className="pl-7"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Goals & services */}
          <Card>
            <CardHeader>
              <CardTitle>Goals &amp; services</CardTitle>
              <CardDescription>
                What success looks like and where you focus.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primaryConversionGoal">
                  Primary conversion goal{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Select
                  id="primaryConversionGoal"
                  name="primaryConversionGoal"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a goal…
                  </option>
                  <option value="calls">Phone calls</option>
                  <option value="form_fills">Form fills</option>
                  <option value="bookings">Bookings</option>
                  <option value="purchases">Purchases</option>
                  <option value="demo_requests">Demo requests</option>
                  <option value="newsletter_signup">Newsletter signup</option>
                  <option value="other">Other</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adStatus">
                  Ad status <span className="text-red-500">*</span>
                </Label>
                <Select id="adStatus" name="adStatus" required defaultValue="">
                  <option value="" disabled>
                    Select status…
                  </option>
                  <option value="not_running">Not running ads</option>
                  <option value="running">Running ads</option>
                  <option value="paused">Paused ads</option>
                  <option value="unknown">Not sure</option>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="topServices">Top services</Label>
                <Textarea
                  id="topServices"
                  name="topServices"
                  rows={3}
                  placeholder="Lawn mowing&#10;Fertilization&#10;Aeration&#10;Leaf removal"
                />
                <p className="text-xs text-muted-foreground">
                  All your services — one per line or comma-separated.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profitableServices">Profitable services</Label>
                <Textarea
                  id="profitableServices"
                  name="profitableServices"
                  rows={3}
                  placeholder="Lawn mowing&#10;Fertilization&#10;Aeration"
                />
                <p className="text-xs text-muted-foreground">
                  Top 3 — one per line or comma-separated.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="targetLocations">Target locations</Label>
                <Textarea
                  id="targetLocations"
                  name="targetLocations"
                  rows={3}
                  placeholder="West Lafayette, IN&#10;Lafayette, IN&#10;Tippecanoe County"
                />
                <p className="text-xs text-muted-foreground">
                  Service area / target locations — one per line or
                  comma-separated.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Marketing & competition */}
          <Card>
            <CardHeader>
              <CardTitle>Marketing &amp; competition</CardTitle>
              <CardDescription>
                Your current marketing posture and who you&apos;re up against.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="marketingStatus">Marketing status</Label>
                <Select
                  id="marketingStatus"
                  name="marketingStatus"
                  defaultValue="unknown"
                >
                  <option value="none">No SEO or PPC</option>
                  <option value="seo_only">SEO only</option>
                  <option value="ppc_only">PPC only</option>
                  <option value="both">Both SEO and PPC</option>
                  <option value="unknown">Not sure</option>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="competitors">Competitors</Label>
                <Textarea
                  id="competitors"
                  name="competitors"
                  rows={3}
                  placeholder="competitor-one.com&#10;Competitor Two&#10;competitor-three.com"
                />
                <p className="text-xs text-muted-foreground">
                  Main competitors — one per line or comma-separated.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="targetCustomer">Target customer</Label>
                <Textarea
                  id="targetCustomer"
                  name="targetCustomer"
                  rows={3}
                  placeholder="Homeowners aged 35–65 with larger lots who value reliable, recurring service…"
                />
                <p className="text-xs text-muted-foreground">
                  Describe your ideal customer.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg">
              Save &amp; continue
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
