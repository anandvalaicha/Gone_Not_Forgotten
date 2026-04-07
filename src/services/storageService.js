import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export const storageService = {
  // Upload a file to Firebase Storage
  uploadFile: async (fileUri, fileName, folder = 'memorials') => {
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const storageRef = ref(storage, `${folder}/${fileName}`);
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return { success: true, url: downloadURL, path: snapshot.ref.fullPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get download URL for a file
  getFileURL: async (filePath) => {
    try {
      const storageRef = ref(storage, filePath);
      const url = await getDownloadURL(storageRef);
      return { success: true, url };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Delete a file from storage
  deleteFile: async (filePath) => {
    try {
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};