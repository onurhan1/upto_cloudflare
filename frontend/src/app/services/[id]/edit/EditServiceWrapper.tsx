'use client';

import dynamic from 'next/dynamic';

const EditServiceClient = dynamic(() => import('./EditServiceClient'), { ssr: false });

export default function EditServiceWrapper() {
    return <EditServiceClient />;
}
