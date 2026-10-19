import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import Landing from "./_components/landing.tsx";
import ControlPanel from "./_components/control-panel";

export default function Index() {
  return (
    <>
      <AuthLoading>
        <div className="mx-auto max-w-5xl p-6">
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <Landing />
      </Unauthenticated>
      <Authenticated>
        <ControlPanel />
      </Authenticated>
    </>
  );
}
