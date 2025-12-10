export const runtime = 'edge';

import ServiceDetailWrapper from './ServiceDetailWrapper';

export default async function ServiceDetailPage(props: { params: Promise<{ id: string }> }) {
  await props.params;
  return <ServiceDetailWrapper />;
}




