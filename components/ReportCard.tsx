import React from "react";
import Link from "next/link";

interface ReportCardProps {
  title: string;
  description: string;
  date: string;
  slug: string;
  tags: string[];
}

const ReportCard: React.FC<ReportCardProps> = ({
  title,
  description,
  date,
  slug,
  tags,
}) => {
  // Format the date to be more readable
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const parsedDate = new Date(dateString);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    return dateString;
  };
  const reportDescription =
    description?.trim() || "No description provided for this report.";

  return (
    <div
      className="bg-white shadow hover:shadow-lg transition-shadow duration-200 overflow-hidden hover:cursor-pointer duration-700"
    >
      <Link href={`/${slug}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-black">{title}</h2>
          </div>
          <p className="text-gray-600 mb-4">{reportDescription}</p>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-deepblue bg-opacity-10 text-deepblue"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-500">{formatDate(date)}</p>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default ReportCard;
