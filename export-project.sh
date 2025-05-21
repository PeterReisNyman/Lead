#!/bin/bash
# Script to export all files from the Site ASP.NET Core project,
# excluding files under /bin, /Debug, /runtimes, /lib and excluding favicon.ico.
# The output is copied to the clipboard.
#
# For macOS users

# Create a temporary file to store the export
TEMP_FILE=$(mktemp /tmp/site-export.XXXXXX)

# Function to display file content with proper formatting
print_file() {
  local file="$1"
  echo -e "\n\n======================================================================" >> "$TEMP_FILE"
  echo -e "FILE: $file" >> "$TEMP_FILE"
  echo -e "======================================================================\n" >> "$TEMP_FILE"
  cat "$file" >> "$TEMP_FILE"
}

# Navigate to project root
cd /Users/peternyman/Desktop/Lead || { echo "Project directory not found!"; exit 1; }

# Print header info to the temp file
echo "EXPORTING ALL FILES (excluding /bin, /Debug, /runtimes, /lib and favicon.ico)" > "$TEMP_FILE"
echo "======================================================================" >> "$TEMP_FILE"

# Recursively find all files, excluding those under /bin, /Debug, /runtimes, /lib and any favicon.ico file.
find . -type f \
  ! -name ".DS_Store" | while IFS= read -r file; do
    print_file "$file"
done

# Check if output is too large (75,000 chars is a safe limit for most API contexts)
OUTPUT_SIZE=$(wc -c < "$TEMP_FILE")
MAX_SIZE=75000

if [ "$OUTPUT_SIZE" -gt "$MAX_SIZE" ]; then
  echo "⚠️ Warning: Output size is $OUTPUT_SIZE bytes, which may be too large to paste in one go."
  echo "Consider splitting the output or further reducing the file selection."
  
  # Optional: Create a split version of the output
  SPLIT_DIR="/tmp/code-export-split"
  mkdir -p "$SPLIT_DIR"
  csplit -f "$SPLIT_DIR/part-" "$TEMP_FILE" '/^FILE:/' '{*}' > /dev/null
  
  echo "Split versions created in $SPLIT_DIR"
  ls -l "$SPLIT_DIR"
else
  echo "✅ Output size is $OUTPUT_SIZE bytes, which should be acceptable."
fi

# Copy the complete export to the clipboard
cat "$TEMP_FILE" | pbcopy

# Inform the user
FILE_COUNT=$(grep -c "^FILE:" "$TEMP_FILE")
echo "✅ $FILE_COUNT files have been copied to your clipboard."
echo "The export file is located at: $TEMP_FILE"
echo "You can now paste it to share with others."
echo "Note: The temporary file was not deleted. You can find it at: $TEMP_FILE"
