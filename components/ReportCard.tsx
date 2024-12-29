import React from 'react';
import Link from 'next/link';

interface ReportCardProps {
  title: string;
  description: string;
  date: string;
  slug: string;
  author: string;
  tags: string[];
}

const ReportCard: React.FC<ReportCardProps> = ({
  title,
  description,
  date,
  slug,
  author,
  tags
}) => {
  // Format the date to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <Link href={`/reports/${slug}`}>
            <h2 className="text-xl font-semibold text-black">{title}</h2>
          </Link>
          <p className="text-sm text-gray-500">{formatDate(date)}</p>
        </div>
        <p className="text-gray-600 mb-4">{description}</p>
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emeraldlight bg-opacity-25 text-darkgreen"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500">By {author}</p>
        </div>
        <Link 
          href={`/reports/${slug}`}
          className="mt-4 inline-flex items-center text-sm font-medium text-black hover:text-emeraldlight duration-700"
        >
          Read More →
        </Link>
      </div>
    </div>
  );
};

export default ReportCard;