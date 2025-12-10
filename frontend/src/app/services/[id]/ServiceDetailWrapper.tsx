'use client';

import dynamic from 'next/dynamic';

const ServiceDetailClient = dynamic(() => import('./ServiceDetailClient'), { ssr: false });

export default function ServiceDetailWrapper() {
    return <ServiceDetailClient />;
}
