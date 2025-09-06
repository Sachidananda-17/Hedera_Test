import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, CheckCircle2, Loader2 } from "lucide-react";

export default function NotaryUI() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!text && !file) return;
    setIsSubmitting(true);
    setProgress(0);

    // Fake progress bar
    let interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 300);

    // Simulated API call
    setTimeout(() => {
      setResult({
        cid: "Qm12345abcdeFakeCID",
        hash: "0xFAKEHASH1234567890",
      });
      setIsSubmitting(false);
      setProgress(100);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-2xl rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Hedera Notary
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* File Upload */}
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-purple-500 transition"
          >
            <Upload className="w-10 h-10 text-gray-500 mb-2" />
            <span className="text-gray-600">
              {file ? file.name : "Click to upload a file"}
            </span>
            <Input
              id="file-upload"
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {/* Text Input */}
          <div>
            <label className="text-gray-700 font-medium mb-2 block">
              Or enter text
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your text here..."
              className="resize-none focus:ring-2 focus:ring-purple-500"
              rows={4}
            />
          </div>

          {/* Progress Bar */}
          {isSubmitting && (
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-2 bg-gradient-to-r from-blue-500 to-purple-600"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeInOut", duration: 0.3 }}
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:scale-105 hover:shadow-2xl"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Notarize Now
                </>
              )}
            </Button>
          </div>

          {/* Results */}
          {result && (
            <motion.div
              className="mt-6 p-4 rounded-xl bg-green-50 border border-green-200 shadow-md"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center gap-2 text-green-700 font-semibold mb-2">
                <CheckCircle2 className="w-5 h-5" />
                Notarization Successful
              </div>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">CID:</span> {result.cid}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Hash:</span> {result.hash}
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
