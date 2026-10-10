import { getRouteApi } from "@tanstack/react-router";
import { AdminCreatorDetailPage } from "./AdminCreatorDetailPage";

export function AdminApplicationDetailPage() {
  const { applicationId } = getRouteApi("/portal_/admin/applications/$applicationId").useParams();
  return <AdminCreatorDetailPage key={applicationId} applicationId={applicationId} />;
}
