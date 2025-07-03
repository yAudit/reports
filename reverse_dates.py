#!/usr/bin/env python3
"""
Script to reverse date format in filenames from MM-YYYY to YYYY-MM
in the content folder and update title fields in frontmatter.
"""

import os
import re
import sys

def update_file_content(file_path):
    """
    Update the title field in the frontmatter to reverse MM-YYYY to YYYY-MM
    
    Args:
        file_path (str): Path to the markdown file
    
    Returns:
        bool: True if content was updated, False otherwise
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern to match title: MM-YYYY-<name> in frontmatter
        title_pattern = r'^title:\s*(\d{2})-(\d{4})-(.+)$'
        
        lines = content.split('\n')
        updated = False
        
        for i, line in enumerate(lines):
            match = re.match(title_pattern, line)
            if match:
                month, year, rest = match.groups()
                new_title = f"title: {year}-{month}-{rest}"
                lines[i] = new_title
                updated = True
                print(f"  Updated title: {line.strip()} -> {new_title}")
                break
        
        if updated:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
        
        return updated
        
    except Exception as e:
        print(f"  Error updating content: {e}")
        return False


def reverse_date_format(content_dir="content"):
    """
    Reverse date format in filenames from MM-YYYY-<name>.md to YYYY-MM-<name>.md
    and update title fields in frontmatter
    
    Args:
        content_dir (str): Directory containing the files to rename
    """
    
    if not os.path.exists(content_dir):
        print(f"Error: Directory '{content_dir}' does not exist.")
        return
    
    # Pattern to match MM-YYYY-<filename>.md
    pattern = r'^(\d{2})-(\d{4})-(.+)\.md$'
    
    renamed_files = []
    skipped_files = []
    updated_content = []
    
    try:
        files = os.listdir(content_dir)
        
        for filename in files:
            match = re.match(pattern, filename)
            
            if match:
                month, year, rest = match.groups()
                new_filename = f"{year}-{month}-{rest}.md"
                
                old_path = os.path.join(content_dir, filename)
                new_path = os.path.join(content_dir, new_filename)
                
                # Check if target file already exists
                if os.path.exists(new_path):
                    print(f"Warning: Target file '{new_filename}' already exists. Skipping '{filename}'")
                    skipped_files.append(filename)
                    continue
                
                try:
                    # First, update the content of the file
                    print(f"Processing: {filename}")
                    content_updated = update_file_content(old_path)
                    if content_updated:
                        updated_content.append(filename)
                    
                    # Then rename the file
                    os.rename(old_path, new_path)
                    renamed_files.append((filename, new_filename))
                    print(f"Renamed: {filename} -> {new_filename}")
                except OSError as e:
                    print(f"Error renaming '{filename}': {e}")
                    skipped_files.append(filename)
            else:
                print(f"Skipping '{filename}' (doesn't match MM-YYYY-<name>.md pattern)")
                skipped_files.append(filename)
    
    except OSError as e:
        print(f"Error reading directory '{content_dir}': {e}")
        return
    
    # Summary
    print(f"\n--- Summary ---")
    print(f"Files renamed: {len(renamed_files)}")
    print(f"Files with updated content: {len(updated_content)}")
    print(f"Files skipped: {len(skipped_files)}")
    
    if renamed_files:
        print("\nSuccessfully renamed files:")
        for old, new in renamed_files:
            print(f"  {old} -> {new}")
    
    if updated_content:
        print("\nFiles with updated title fields:")
        for filename in updated_content:
            print(f"  {filename}")


def main():
    """Main function to run the script."""
    print("Date Format Reversal Script")
    print("Converting MM-YYYY-<name>.md to YYYY-MM-<name>.md")
    print("Also updating title fields in frontmatter")
    print("-" * 60)
    
    # Ask for confirmation
    response = input("Do you want to proceed with renaming files? (y/N): ")
    if response.lower() not in ['y', 'yes']:
        print("Operation cancelled.")
        return
    
    reverse_date_format()


if __name__ == "__main__":
    main() 