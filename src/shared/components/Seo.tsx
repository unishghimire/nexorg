import React from 'react';
import { BASE_URL } from '../constants/constants';
import { Helmet } from 'react-helmet-async';

// ponytail: One reusable SEO component — covers title, meta, canonical, OG, Twitter, JSON-LD
// No abstraction beyond what every public page needs.

const SITE_NAME = 'NexPlay';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.jpg`;

interface SeoProps {
    title: string;
    description: string;
    canonicalPath?: string;
    ogType?: string;
    ogImage?: string;
    jsonLd?: object | object[];
    noindex?: boolean;
    children?: React.ReactNode;
}

export const Seo: React.FC<SeoProps> = ({
    title,
    description,
    canonicalPath,
    ogType = 'website',
    ogImage = DEFAULT_OG_IMAGE,
    jsonLd,
    noindex = false,
    children,
}) => {
    const canonicalUrl = canonicalPath ? `${BASE_URL}${canonicalPath}` : undefined;
    const robotsContent = noindex ? 'noindex, follow' : 'index, follow';

    return (
        <Helmet>
            <title>{title}</title>
            <meta name="description" content={description} />
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

            {/* Favicons & Icons for Googlebot-Favicon */}
            <link rel="icon" type="image/png" sizes="512x512" href={`${BASE_URL}/logo.png`} />
            <link rel="icon" type="image/png" sizes="192x192" href={`${BASE_URL}/logo.png`} />
            <link rel="icon" type="image/png" sizes="48x48" href={`${BASE_URL}/logo.png`} />
            <link rel="shortcut icon" href={`${BASE_URL}/logo.png`} />
            <link rel="apple-touch-icon" href={`${BASE_URL}/apple-touch-icon.png`} />

            {/* Open Graph */}
            <meta property="og:type" content={ogType} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:locale" content="en_NP" />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={ogImage} />
            <meta property="og:image:width" content="1024" />
            <meta property="og:image:height" content="1024" />
            {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />

            {/* JSON-LD Structured Data */}
            {jsonLd && (
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            )}

            {children}
        </Helmet>
    );
};

export default Seo;
