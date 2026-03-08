import { Construction } from "lucide-react";

const Maintenance = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <Construction className="h-20 w-20 text-primary mb-6" />
      <h1 className="text-4xl font-bold text-foreground mb-3">Site Under Maintenance</h1>
      <p className="text-lg text-muted-foreground max-w-md">
        हम अभी साइट पर कुछ काम कर रहे हैं। कृपया कुछ देर बाद दोबारा आएं।
      </p>
      <p className="text-sm text-muted-foreground mt-2">We'll be back shortly!</p>
    </div>
  );
};

export default Maintenance;
