export const runtime = 'edge';

import EditServiceWrapper from './EditServiceWrapper';

export default async function EditServicePage(props: { params: Promise<{ id: string }> }) {
    await props.params;
    return <EditServiceWrapper />;
}
