export default defineContentScript({
  matches: ['https://leetcode.com/problems/*'],
  main() {
    console.log('LeetCode Revision Buddy: content script loaded');
  },
});
