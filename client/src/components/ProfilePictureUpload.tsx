import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfilePictureUploadProps {
  currentImage?: string;
  initials?: string;
  onImageChange: (imageUrl: string | null) => void;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
}

export function ProfilePictureUpload({ 
  currentImage, 
  initials = "U", 
  onImageChange, 
  size = "md",
  editable = true 
}: ProfilePictureUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState(currentImage || "");
  const [isUploading, setIsUploading] = useState(false);

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20", 
    lg: "w-32 h-32"
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Convert to base64 for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        onImageChange(result);
      };
      reader.readAsDataURL(file);

      toast({
        title: "Image Updated",
        description: "Profile picture has been updated.",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview("");
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({
      title: "Image Removed",
      description: "Profile picture has been removed.",
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="relative group">
        <Avatar className={sizeClasses[size]}>
          <AvatarImage 
            src={imagePreview} 
            alt="Profile"
          />
          <AvatarFallback className="bg-primary text-white font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {editable && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer">
            <Camera 
              className="w-6 h-6 text-white" 
              onClick={handleUploadClick}
            />
          </div>
        )}
      </div>

      {editable && (
        <div className="flex flex-col space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? "Uploading..." : "Upload Image"}</span>
          </Button>
          
          {imagePreview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveImage}
              className="flex items-center space-x-2 text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4" />
              <span>Remove</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}