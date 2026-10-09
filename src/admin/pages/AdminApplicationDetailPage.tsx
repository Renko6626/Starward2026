import { getRouteApi } from "@tanstack/react-router";
import { AdminCreatorDetailPage } from "./AdminCreatorDetailPage";

export function AdminApplicationDetailPage() {
  const { applicationId } = getRouteApi("/admin/applications/$applicationId").useParams();
  return <AdminCreatorDetailPage key={applicationId} applicationId={applicationId} />;
}
