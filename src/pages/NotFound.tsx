import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User tried to access a non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold text-red-500">404</h1>
        <p className="mb-4 text-xl text-gray-700">
          This feature is currently under development and will be available very soon.
        </p>
        <p className="mb-6 text-lg text-gray-500">
          We’re sorry for the inconvenience. Please check back later!
        </p>
        <a
          href="/"
          className="text-blue-600 underline hover:text-blue-800 transition-colors duration-200"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
