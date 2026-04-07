import { db } from '../config/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

export const memorialService = {
  // Create a new memorial
  createMemorial: async (userId, memorialData) => {
    try {
      const docRef = await addDoc(collection(db, 'memorials'), {
        ...memorialData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get all memorials for a user
  getUserMemorials: async (userId) => {
    try {
      const q = query(collection(db, 'memorials'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const memorials = [];
      querySnapshot.forEach((doc) => {
        memorials.push({ id: doc.id, ...doc.data() });
      });
      return { success: true, memorials };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get a specific memorial
  getMemorial: async (memorialId) => {
    try {
      const docRef = doc(db, 'memorials', memorialId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { success: true, memorial: { id: docSnap.id, ...docSnap.data() } };
      } else {
        return { success: false, error: 'Memorial not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update a memorial
  updateMemorial: async (memorialId, updateData) => {
    try {
      const docRef = doc(db, 'memorials', memorialId);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Add media path to memorial
  appendMedia: async (memorialId, mediaType, mediaUrl) => {
    try {
      const docRef = doc(db, 'memorials', memorialId);
      const memorialDoc = await getDoc(docRef);
      if (!memorialDoc.exists()) {
        return { success: false, error: 'Memorial not found' };
      }
      const data = memorialDoc.data();
      const field = `${mediaType}`;
      const existing = Array.isArray(data[field]) ? data[field] : [];
      await updateDoc(docRef, {
        [field]: [...existing, mediaUrl],
        updatedAt: new Date(),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Delete a memorial
  deleteMemorial: async (memorialId) => {
    try {
      await deleteDoc(doc(db, 'memorials', memorialId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};